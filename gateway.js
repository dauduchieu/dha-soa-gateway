const express = require("express");
const { createProxyMiddleware } = require("http-proxy-middleware");
const axios = require("axios");
const cors = require("cors");

const app = express();
const port = 3000;

/* ======================
   GLOBAL MIDDLEWARE
====================== */
app.use(cors());

// Log để debug
app.use((req, res, next) => {
  console.log(`[GATEWAY] ${req.method} ${req.originalUrl}`);
  next();
});

/* ======================
   SERVICE TARGETS
====================== */
const authServiceTarget = "https://dha-soa-auth.onrender.com";
const forumServiceTarget = "https://dha-soa-forum.onrender.com";
const assistantServiceTarget = "https://dauduchieu-dha-soa-assistant.hf.space";
const ragServiceTarget = "https://dauduchieu-dha-soa-rag.hf.space";

/* ======================
   PROXY FACTORY
====================== */
const proxy = (target) =>
  createProxyMiddleware({
    target,
    changeOrigin: true,
    timeout: 60000,
    proxyTimeout: 60000,

    onError(err, req, res) {
      console.error("[PROXY ERROR]", err.message);
      res.status(502).json({ message: "Bad gateway" });
    },
  });

/* ======================
   AUTH MIDDLEWARE
====================== */
const authMiddleware = async (req, res, next) => {
  try {
    const response = await axios.post(
      `${authServiceTarget}/auth/verify`,
      {},
      {
        headers: {
          authorization: req.header("authorization"),
        },
        timeout: 5000,
      }
    );

    const data = response.data;

    if (!data.verified) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    // forward identity
    req.headers["x-user-id"] = data.user_id;
    req.headers["x-user-role"] = data.role;

    next();
  } catch (err) {
    console.error("[AUTH ERROR]", err.message);
    return res.status(401).json({ message: "Unauthorized" });
  }
};

/* ======================
   AUTH ROUTES
====================== */
app.post("/auth/register", proxy(authServiceTarget));
app.post("/auth/login", proxy(authServiceTarget));
app.post("/auth/google", proxy(authServiceTarget));
app.post("/auth/refresh", proxy(authServiceTarget));

app.get("/auth/users/me", authMiddleware, proxy(authServiceTarget));
app.put("/auth/users/me", authMiddleware, proxy(authServiceTarget));

// Admin
app.post("/auth/users", authMiddleware, proxy(authServiceTarget));
app.get("/auth/users", authMiddleware, proxy(authServiceTarget));
app.get("/auth/users/:id", authMiddleware, proxy(authServiceTarget));
app.put("/auth/users/:id", authMiddleware, proxy(authServiceTarget));

/* ======================
   FORUM ROUTES
====================== */
app.post("/forum/posts", authMiddleware, proxy(forumServiceTarget));
app.get("/forum/posts", proxy(forumServiceTarget));
app.get("/forum/posts/:post_id", proxy(forumServiceTarget));
app.put("/forum/posts/:post_id", authMiddleware, proxy(forumServiceTarget));
app.delete("/forum/posts/:post_id", authMiddleware, proxy(forumServiceTarget));

app.post(
  "/forum/posts/:post_id/comments",
  authMiddleware,
  proxy(forumServiceTarget)
);
app.get(
  "/forum/posts/:post_id/comments",
  proxy(forumServiceTarget)
);
app.put(
  "/forum/posts/:post_id/comments/:comment_id",
  authMiddleware,
  proxy(forumServiceTarget)
);
app.delete(
  "/forum/posts/:post_id/comments/:comment_id",
  authMiddleware,
  proxy(forumServiceTarget)
);

/* ======================
   ASSISTANT ROUTES
====================== */
app.post("/assistant/chats", authMiddleware, proxy(assistantServiceTarget));
app.get("/assistant/chats", authMiddleware, proxy(assistantServiceTarget));
app.get(
  "/assistant/chats/:chat_id/messages",
  authMiddleware,
  proxy(assistantServiceTarget)
);
app.post(
  "/assistant/chats/:chat_id/messages",
  authMiddleware,
  proxy(assistantServiceTarget)
);
app.put(
  "/assistant/chats/:chat_id",
  authMiddleware,
  proxy(assistantServiceTarget)
);
app.delete(
  "/assistant/chats/:chat_id",
  authMiddleware,
  proxy(assistantServiceTarget)
);

/* ======================
   RAG ROUTES
====================== */
app.post("/rag/documents", authMiddleware, proxy(ragServiceTarget));
app.get("/rag/documents", authMiddleware, proxy(ragServiceTarget));
app.delete("/rag/documents", authMiddleware, proxy(ragServiceTarget));

/* ======================
   START SERVER
====================== */
app.listen(port, () => {
  console.log(`🚀 API Gateway running on port ${port}`);
});
