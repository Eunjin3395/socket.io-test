const express = require("express");
const http = require("http");
const path = require("path");
const { join } = require("node:path");

const socketIo = require("socket.io");
const jwt = require("jsonwebtoken");
const cors = require("cors");
const axios = require("axios");

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// 스프링 부트와 동일한 Base64로 인코딩된 비밀 키
const base64Secret = "secretsecretsecretsecretsecretsecretsecretsecretsecretsecretsecretsecretsecretsecretsecretsecret";
const jwtSecret = Buffer.from(base64Secret, "base64");

// 연결된 모든 소켓의 socketId 출력하기
function printConnectedSocketIds() {
  const connectedSockets = io.sockets.sockets;
  // console.log(connectedSockets);
  console.log("==================== socket connections START ====================");
  connectedSockets.forEach((socket, key) => {
    console.log(`Socket ID: ${key}`);
    console.log(`member ID: ${socket.memberId}`);
  });
  console.log("==================== socket connections END ====================");
}

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.sendFile(join(__dirname, "index.html"));
});

app.post("/auth", (req, res) => {
  const token = req.body.token || req.headers.authorization.split(" ")[1];
  if (!token) {
    console.log("!token");
    return res.status(401).json({ authenticated: false });
  }
  jwt.verify(token, jwtSecret, (err, decoded) => {
    //API 서버에서 발급받은 jwt를 여기서도 같은 secret key를 이용해 검증
    if (err) {
      console.log("token", token);
      console.log(err);
      return res.status(401).json({ authenticated: false });
    }
    res.json({ authenticated: true });
  });
});

//socket 요청마다 jwt 토큰을 검사하는 middleware
io.use((socket, next) => {
  const token = socket.handshake.headers["authorization"];
  if (token) {
    jwt.verify(token.split(" ")[1], jwtSecret, (err, decoded) => {
      if (err) {
        return next(new Error("Authentication error"));
      }
      socket.decoded = decoded;
      socket.memberId = decoded.memberId;

      next();
    });
  } else {
    next(new Error("Authentication error"));
  }
});

io.on("connection", (socket) => {
  console.log("a user connected, memberId:", socket.memberId, "socketId:", socket.id);
  let friendIdList = [];

  // Socket connection이 생성되면 localhost:8080/v1/member/friends로 GET 요청
  axios
    .get("http://localhost:8080/v1/member/friends", {
      headers: {
        Authorization: `Bearer ${socket.handshake.headers["authorization"].split(" ")[1]}`,
      },
    })
    .then((response) => {
      if (response.data.isSuccess) {
        const friends = response.data.result.friendInfoDtoList;
        console.log(`== member ID: ${socket.memberId}, friend's member ID & Name list START ==`);
        friends.forEach((friend) => {
          console.log(`Friend ID: ${friend.memberId}, Name: ${friend.name}`);
          friendIdList.push(friend.memberId);
        });
        console.log(`== member ID: ${socket.memberId}, friend's member ID & Name list END ==`);
      } else {
        console.log("Failed to fetch friends:", response.data.message);
      }

      console.log(`== member ID: ${socket.memberId}, friend's socket ID list START ==`);
      let connectedSockets = io.sockets.sockets;
      connectedSockets.forEach((connSocket, key) => {
        if (friendIdList.includes(connSocket.memberId)) {
          console.log(`MemberId: ${connSocket.memberId}, Key: ${key}`);
        }
      });
      console.log(`== member ID: ${socket.memberId}, friend's socket ID list END ==`);
    })
    .catch((error) => {
      console.error("Error fetching friends data:", error);
    });

  // socket event listeners

  socket.on("printSocketIds", () => {
    printConnectedSocketIds();
  });

  socket.on("chat message", (msg) => {
    io.emit("chat message", msg);
  });

  socket.on("disconnect", () => {
    console.log("user disconnected");
  });
});

server.listen(3000, () => {
  console.log("listening on *:3000");
});
