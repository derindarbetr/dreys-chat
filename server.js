const express = require("express");
const socketio = require("socket.io");
const fs = require("fs");
const path = require("path");

const app = express();
const server = app.listen(3000, () => {
    console.log("Sunucu 3000 portunda çalışıyor.");
});

const io = socketio(server);

app.use(express.static("public"));
app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads'))); // Resimler için static yol

let users = {};

io.on("connection", (connectedSocket) => {
    console.log("Bir kullanıcı bağlandı.");

    connectedSocket.on("join", (username) => {
        let usernameExists = false;
        for (const socketId in users) {
            if (users[socketId] === username) {
                usernameExists = true;
                break;
            }
        }
        if (usernameExists) {
            connectedSocket.emit("usernameTaken");
            return;
        }

        users[connectedSocket.id] = username;
        console.log(`${username} chat'e katıldı.`);

        connectedSocket.emit("loginSuccess");

        io.sockets.emit("updateUserList", Object.values(users));
    });

    connectedSocket.on("chat", (data) => {
        console.log(`Mesaj alındı: ${data.username} - ${data.message}`);
        fs.appendFile("chatlog.txt", `${data.username}: ${data.message}\n`, (err) => {
            if (err) {
                console.error("Dosyaya yazma hatası:", err);
            } else {
                console.log("Mesaj dosyaya kaydedildi.");
            }
        });
        io.sockets.emit("chat", data);
    });

    connectedSocket.on("privateHelp", (data) => {
        const requestingUsername = users[connectedSocket.id];
        console.log(`Help command used:: ${requestingUsername}`);

        const helpData = {
            username: "Chat Rules",
            message: "\n1 - Be mindful of OpSec, don't share your info.\n2 - Don't trust claims of being a manager.\n3 - Be cautious with posted links.\n4 - Don't spam or disturb others.",
            forUser: requestingUsername
        };

        connectedSocket.emit("chat", helpData);
    });

    connectedSocket.on("deleteAllMessages", () => {
        fs.writeFile("chatlog.txt", "", (err) => {
            if (err) {
                console.error("Dosya silme hatası:", err);
            } else {
                console.log("Tüm mesajlar silindi.");
                io.sockets.emit("chatCleared");
            }
        });
    });

    connectedSocket.on("privateMessage", (data) => {
        const recipientUsername = data.recipientUsername;
        const senderUsername = data.senderUsername;
        const message = data.message;

        console.log(`Özel mesaj alındı: ${senderUsername} -> ${recipientUsername}: ${message}`);

        let recipientSocketId = null;
        for (const socketId in users) {
            if (users[socketId] === recipientUsername) {
                recipientSocketId = socketId;
                break;
            }
        }

        if (recipientSocketId) {
            connectedSocket.emit("privateMessage", data);
            io.to(recipientSocketId).emit("privateMessage", data);
        } else {
            console.log(`Kullanıcı bulunamadı: ${recipientUsername}`);
            connectedSocket.emit("privateMessageFailed", { message: "Kullanıcı şu anda çevrimiçi değil." });
        }
    });

    connectedSocket.on("image", (data) => {
        io.sockets.emit("image", { username: users[connectedSocket.id], imageUrl: data.imageUrl });
    });

    connectedSocket.on("disconnect", () => {
        const username = users[connectedSocket.id];
        if (username) {
            console.log(`${username} chat'ten ayrıldı.`);
            delete users[connectedSocket.id];
            io.sockets.emit("updateUserList", Object.values(users));
        }
    });
});