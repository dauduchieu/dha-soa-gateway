const express = require("express")
const { createProxyMiddleware } = require('http-proxy-middleware')
const axios = require("axios")
const cors = require("cors")

const app = express()
const port = 3000

app.use(express.json())
app.use(cors())

const authServiceTarget = "https://dha-soa-auth.onrender.com"
const forumServiceTarget = "https://dha-soa-forum.onrender.com"
const assistantServiceTarget = "https://dauduchieu-dha-soa-assistant.hf.space"
const ragServiceTarget = "https://dauduchieu-dha-soa-rag.hf.space"

const proxyMiddleware = (target) =>
  createProxyMiddleware({
    target,
    changeOrigin: true,

    onProxyReq(proxyReq, req, res) {
      const contentType = req.headers["content-type"];
      const isMultipart =
        contentType && contentType.includes("multipart/form-data");

      if (
        req.body &&
        !isMultipart &&
        Object.keys(req.body).length > 0
      ) {
        const bodyData = JSON.stringify(req.body);
        proxyReq.setHeader("Content-Type", "application/json");
        proxyReq.setHeader("Content-Length", Buffer.byteLength(bodyData));
        proxyReq.write(bodyData);
      }
    },

    onError(err, req, res) {
      console.error("Proxy error:", err);
      res.status(502).json({ message: "Bad gateway" });
    },
});

const authMiddleware = async (req, res, next) => {
    console.log(`${authServiceTarget}/auth/verify`)
    const response = await axios.post(`${authServiceTarget}/auth/verify`, {}, {
        headers: {
            'authorization': req.header("authorization"),
        }
    })

    const data = await response.data
    // response: {
    //     "verified": "boolean",
    //     "user_id": "int",
    //     "role": "string" // e.g. "ADMIN" | "MEMBER"
    // }
    if (!data.verified) {
        return res.status(401).json({ message: "Unauthorized" })
    }

    req.headers["x-user-id"] = data.user_id
    req.headers["x-user-role"] = data.role
    next()
}

app.post("/auth/register", proxyMiddleware(authServiceTarget))
app.post("/auth/login", proxyMiddleware(authServiceTarget))
app.post("/auth/google", proxyMiddleware(authServiceTarget))
app.post("/auth/refresh", proxyMiddleware(authServiceTarget))
app.get("/auth/users/me", authMiddleware, proxyMiddleware(authServiceTarget))
app.put("/auth/users/me", authMiddleware, proxyMiddleware(authServiceTarget))
// Admin
app.post("/auth/users", authMiddleware, proxyMiddleware(authServiceTarget));
app.get("/auth/users", authMiddleware, proxyMiddleware(authServiceTarget));
app.get("/auth/users/:id", authMiddleware, proxyMiddleware(authServiceTarget));
app.put("/auth/users/:id", authMiddleware, proxyMiddleware(authServiceTarget));

app.post("/forum/posts", authMiddleware, proxyMiddleware(forumServiceTarget))
app.get("/forum/posts/:post_id", proxyMiddleware(forumServiceTarget))
app.get("/forum/posts", proxyMiddleware(forumServiceTarget))
app.put("/forum/posts/:post_id", authMiddleware, proxyMiddleware(forumServiceTarget))
app.delete("/forum/posts/:post_id", authMiddleware, proxyMiddleware(forumServiceTarget))

app.post("/forum/posts/:post_id/comments", authMiddleware, proxyMiddleware(forumServiceTarget))
app.get("/forum/posts/:post_id/comments", proxyMiddleware(forumServiceTarget))
app.put("/forum/posts/:post_id/comments/:comment_id", authMiddleware, proxyMiddleware(forumServiceTarget))
app.delete("/forum/posts/:post_id/comments/:comment_id", authMiddleware, proxyMiddleware(forumServiceTarget))

app.post("/assistant/chats", authMiddleware, proxyMiddleware(assistantServiceTarget))
app.get("/assistant/chats", authMiddleware, proxyMiddleware(assistantServiceTarget))
app.get("/assistant/chats/:chat_id/messages", authMiddleware, proxyMiddleware(assistantServiceTarget))
app.post("/assistant/chats/:chat_id/messages", authMiddleware, proxyMiddleware(assistantServiceTarget))
app.put("/assistant/chats/:chat_id", authMiddleware, proxyMiddleware(assistantServiceTarget))
app.delete("/assistant/chats/:chat_id", authMiddleware, proxyMiddleware(assistantServiceTarget))

app.post("/rag/documents", authMiddleware, proxyMiddleware(ragServiceTarget))
app.get("/rag/documents", authMiddleware, proxyMiddleware(ragServiceTarget))
app.delete("/rag/documents", authMiddleware, proxyMiddleware(ragServiceTarget))

app.listen(port, () => console.log(`Gateway is running at port ${port}`))
