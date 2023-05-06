import * as store from './store.js';
import * as ui from './ui.js';
import * as webRTCHandler from './webRTCHandler.js';
import * as constants from './constants.js';
import * as strangerUtils from './strangerUtils.js';

let socketIo = null; 

export const registerSocketEvents = (socket) => {
  socketIo = socket;

  socket.on("connect", () => {
    
    console.log("succesfully connected to socket.io server");
    store.setSocketId(socket.id);
    ui.updatePersonalCode(socket.id);
  });

  socket.on('pre-offer', (data) => {
    webRTCHandler.handlePreOffer(data);
  })

  socket.on('pre-offer-answer', (data) => {
    webRTCHandler.handlePreOfferAnswer(data);
  })

  socket.on('user-hanged-up', () => {
    webRTCHandler.handleConnectedUserHangedUp();
  })

  socket.on('stranger-socket-id', (data) => {
    strangerUtils.connectWithStranger(data);
  })

  socket.on('webRTC-signaling', (data) => {
    switch (data.type) {
      case constants.webRTCSignaling.OFFER:
        webRTCHandler.handlerWebRTCOffer(data);
        break;
      case constants.webRTCSignaling.ANSWER:
        webRTCHandler.handleWebRTCAnswer(data);
        break;
      case constants.webRTCSignaling.ICE_CANDIDATE:
        webRTCHandler.handleWebRTCCandidate(data);
        break;
      default:
        return;
    }
  })
}

// 1. Caller가 Callee에게 Chat 또는 Video 요청
export const sendPreOffer = (data) => {
  console.log('emmiting to server pre offer event');
  socketIo.emit('pre-offer', data);
}

// 2. Callee가 Caller에게 응답 
export const sendPreOfferAnswer = (data) => {
  socketIo.emit('pre-offer-answer', data);
}

// 3. WebRTC를 위한 데이터 교환
export const sendDataUsingWebRTCSignaling = (data) => {
  socketIo.emit('webRTC-signaling', data);
}

export const sendUserHangUp = (data) => {
  socketIo.emit("user-hanged-up", data);
}

export const changeStrangerConnectionStatus = (data) => {
  socketIo.emit('stranger-connection-status', data);
}

export const getStrangerSocketId = () => {
  socketIo.emit('get-stranger-socket-id');
}