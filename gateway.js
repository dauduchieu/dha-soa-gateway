const express = require("express");
const axios = require("axios");
const cors = require("cors");

const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());

/* ======================
   SERVICE TARGETS
====================== */
const SERVICES = {
  auth: "https://dha-soa-auth.onrender.com",
  forum: "https://dha-soa-forum.onrender.com",
  assistant: "https://dauduchieu-dha-soa-assistant.hf.space",
  rag: "https://dauduchieu-dha-soa-rag.hf.space",
};

/* ======================
   AUTH MIDDLEWARE
====================== */
const authMiddleware = async (req, res, next) => {
  try {
    const response = await axios.post(
      `${SERVICES.auth}/auth/verify`,
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

    req.user = {
      id: data.user_id,
      role: data.role,
    };

    next();
  } catch (err) {
    console.error("[AUTH ERROR]", err.message);
    return res.status(401).json({ message: "Unauthorized" });
  }
};

/* ======================
   GENERIC FORWARDER
====================== */
const forward = (serviceName, stripPrefix) => async (req, res) => {
  try {
    const url =
      SERVICES[serviceName] +
      req.originalUrl.replace(stripPrefix, "");

    const response = await axios({
      method: req.method,
      url,
      headers: {
        ...req.headers,
        host: undefined,
        "x-user-id": req.user?.id,
        "x-user-role": req.user?.role,
      },
      data: req.body,
      params: req.query,
      timeout: 60000,
    });

    res.status(response.status).json(response.data);
  } catch (err) {
    console.error(
      "[FORWARD ERROR]",
      err.response?.status,
      err.message
    );

    res
      .status(err.response?.status || 502)
      .json(err.response?.data || { message: "Bad gateway" });
  }
};

/* ======================
   ROUTES
====================== */

// Auth (no verify)
app.post("/auth/register", forward("auth", ""));
app.post("/auth/login", forward("auth", ""));
app.post("/auth/google", forward("auth", ""));
app.post("/auth/refresh", forward("auth", ""));

// Auth (verify)
app.get("/auth/users/me", authMiddleware, forward("auth", ""));
app.put("/auth/users/me", authMiddleware, forward("auth", ""));
app.post("/auth/users", authMiddleware, forward("auth", ""));
app.get("/auth/users", authMiddleware, forward("auth", ""));
app.get("/auth/users/:id", authMiddleware, forward("auth", ""));
app.put("/auth/users/:id", authMiddleware, forward("auth", ""));

// Forum
app.post("/forum/posts", authMiddleware, forward("forum", "/forum"));
app.get("/forum/posts", forward("forum", "/forum"));
app.get("/forum/posts/:id", forward("forum", "/forum"));
app.put("/forum/posts/:id", authMiddleware, forward("forum", "/forum"));
app.delete("/forum/posts/:id", authMiddleware, forward("forum", "/forum"));

// Assistant
app.post("/assistant/chats", authMiddleware, forward("assistant", "/assistant"));
app.get("/assistant/chats", authMiddleware, forward("assistant", "/assistant"));
app.post(
  "/assistant/chats/:id/messages",
  authMiddleware,
  forward("assistant", "/assistant")
);

// RAG
app.post("/rag/documents", authMiddleware, forward("rag", "/rag"));
app.get("/rag/documents", authMiddleware, forward("rag", "/rag"));
app.delete("/rag/documents", authMiddleware, forward("rag", "/rag"));

/* ======================
   START
====================== */
app.listen(port, () => {
  console.log(`🚀 Gateway running on port ${port}`);
});
