import { Server } from "socket.io";

const getAllowedOrigins = () => {
    const raw = process.env.CORS_ORIGINS || ''
    const list = raw
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean)
    return list
}

let io;

const initSocket = (httpServer) => {
    const allowedOrigins = getAllowedOrigins()
    const allowAll = allowedOrigins.length === 0

    io = new Server(httpServer, {
        cors: {
            origin: allowAll ? true : allowedOrigins,
            methods: ["GET", "POST"],
            credentials: true
        }
    });

    io.on("connection", (socket) => {
        const { role, userId } = socket.handshake.auth || {};

        if (role === "admin") {
            socket.join("admin");
        }

        if (role === "user" && userId) {
            socket.join(`user:${userId}`);
        }
    });

    return io;
};

const getIO = () => {
    if (!io) {
        throw new Error("Socket.io not initialized");
    }
    return io;
};

export { initSocket, getIO };
