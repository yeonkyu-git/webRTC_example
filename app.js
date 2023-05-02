const express = require("express");
const http = require("http");

const PORT = process.env.PORT || 3000;

const app = express();
const server = http.createServer(app);
const io = require("socket.io")(server);

app.use(express.static("public"));

app.get("/", (req, res) => {
  res.sendFile(__dirname + "/public/index.html");
});

let connectedPeers = []; // 웹소켓 연결 중인 유저 리스트 (socketId)

// 유저가 초기 웹 접속 시 Websocket 통신 시작
io.on("connection", (socket) => {
  connectedPeers.push(socket.id); // 유저 리스트에 socketId 추가

  // 1. Caller가 Callee SocketId를 입력한 후 Chat 또는 Video Call 요청
  socket.on('pre-offer', (data) => {
    const { calleePersonalCode, callType } = data;

    // Callee SocketId가 현재 접속중인 User 목록에 있는지 확인 
    const connectedPeer = connectedPeers.find((peerSocketId) => 
      peerSocketId === calleePersonalCode
    );

    // Callee가 접속 중이라면 Callee에게 callTpye과 caller의 socketId를 전달
    if (connectedPeer) {
      const data = {
        callerSocketId: socket.id,
        callType,
      };

      io.to(calleePersonalCode).emit('pre-offer', data);
    } 
    // Callee가 없다면 Caller에게 Callee가 없다는 데이터를 전달
    else {
      const data = {
        preOfferAnswer: 'CALLEE_NOT_FOUND',
      }
      io.to(socket.id).emit('pre-offer-answer', data);
    }
  });

  // 2. Callee 가 Caller에게 요청에 대한 응답
  socket.on('pre-offer-answer', (data) => {
    console.log('pre-offer-answer');
    const { callerSocketId } = data;
    
    const connectedPeer = connectedPeers.find((peerSocketId) => 
      peerSocketId === callerSocketId
    );

    if (connectedPeer) {
      io.to(data.callerSocketId).emit('pre-offer-answer', data);
    }
  })

  // 2. 다른 사람에게 SDP 정보 전달 (ICE_CANDIDATE)
  socket.on('webRTC-signaling', (data) => {
    const { connectedUserSocketId } = data;

    const connectedPeer = connectedPeers.find((peerSocketId) => 
      peerSocketId === connectedUserSocketId
    );

    if (connectedPeer) {
      io.to(connectedUserSocketId).emit('webRTC-signaling', data);
    }
  })

  socket.on("disconnect", () => {
    console.log("user disconnected");

    const newConnectedPeers = connectedPeers.filter((peerSocketId) => 
        peerSocketId !== socket.id
    );

    connectedPeers = newConnectedPeers;
    console.log(connectedPeers);
  });
});

server.listen(PORT, () => {
  console.log(`listening on ${PORT}`);
});
