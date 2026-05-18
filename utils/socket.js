import { Server } from "socket.io";

const getAllowedOrigins = () => {
    const raw = process.env.CORS_ORIGINS || ''
    const list = raw
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean)
    return list
}

const isAllowedVercelPreviewOrigin = (origin) => {
    try {
        const { hostname, protocol } = new URL(origin)
        return protocol === "https:" && hostname.endsWith("-devansh2123s-projects.vercel.app")
    } catch {
        return false
    }
}

let io;

const initSocket = (httpServer) => {
    const allowedOrigins = getAllowedOrigins()
    const allowAll = allowedOrigins.length === 0

    io = new Server(httpServer, {
        cors: {
            origin: allowAll
                ? true
                : (origin, callback) => {
                    if (!origin) return callback(null, true)
                    if (allowedOrigins.includes(origin) || isAllowedVercelPreviewOrigin(origin)) {
                        return callback(null, true)
                    }
                    return callback(new Error("CORS: Origin not allowed"))
                },
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
