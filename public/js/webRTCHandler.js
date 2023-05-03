import * as wss from './wss.js';
import * as constants from './constants.js';
import * as ui from './ui.js';
import * as store from './store.js';

let connectedUserDetails;
let peerConnection;
let dataChannel;

const defaultContraints = {
  audio: true,
  video: true
};

const configuration = {
  iceServers: [
    {
      urls: 'stun:stun.l.google.com:13902'
    },
  ],
}

// 나의 비디오 및 오디오 접근 
export const getLocalPreview = () => {
  navigator.mediaDevices.getUserMedia(defaultContraints)
    .then((stream) => {
      ui.updateLocalVideo(stream);
      store.setLocalStream(stream);
    }).catch((err) => {
      console.error('error occured when trying to get an access to camera', err);
    })
}

// 요청 수락 시 상대방과 Connection  (RTCPeerConnection)
const createPeerConnection = () => {
  peerConnection = new RTCPeerConnection(configuration); // 이때 STUN 서버에게 질의함

  dataChannel = peerConnection.createDataChannel('chat');

  peerConnection.ondatachannel = (event) => {
    const dataChannel = event.channel;

    dataChannel.onopen = () => {
      console.log('peer connection is ready to receive data channel messages');
    }

    // Message 받기 
    dataChannel.onmessage = (event) => {
      console.log('message came from data channel');
      const message = JSON.parse(event.data);
      ui.appendMessage(message);
    }
  }


  // ICE_CANDIDATE 교환 
  peerConnection.onicecandidate = (event) => {
    console.log('getting ice candidates from stun server');
    if (event.candidate) {
      // send our ice candidates to other peer
      wss.sendDataUsingWebRTCSignaling({
        connectedUserSocketId: connectedUserDetails.socketId, // 다른 사람의 Socket Id 
        type: constants.webRTCSignaling.ICE_CANDIDATE, // ICE_CANDIDATE (SDP 교환)
        candidate: event.candidate, // candidate
      })
      
    }
  }

  // Connection이 정상 연결 되었을 경우 
  peerConnection.onconnectionstatechange = (event) => {
    if (peerConnection.connectionState === 'connected') {
      console.log('successfully connected with other peer');
    }
  }

  // 상대방의 화면 정보를 전달 받아서, ui에 비디오를 업데이트 한다. 
  const remoteStream = new MediaStream();
  store.setRemoteStream(remoteStream);
  ui.updateRemoteVideo(remoteStream);

  peerConnection.ontrack = (event) => {
    remoteStream.addTrack(event.track);
  };

  // 자신의 화면을 상대방에게 전달한다.
  if (connectedUserDetails.callType === constants.callType.VIDEO_PERSONAL_CODE) {
    const localStream = store.getState().localStream;

    for (const track of localStream.getTracks()) {
      peerConnection.addTrack(track, localStream);
    }
  }
};


// DataChannel로 메시지 전달 (Chatting)
export const sendMessageUsingDataChannel = (message) => {
  const stringifiedMessage = JSON.stringify(message);
  dataChannel.send(stringifiedMessage);
}


// 1. Caller가 Callee 에게 Chat 또는 Video 요청
export const sendPreOffer = (callType, calleePersonalCode) => {
  connectedUserDetails = {
    callType, // Chat인지 Video인지 Type 
    socketId: calleePersonalCode  // Caller가 입력한 Callee Socket Id
  };

  if (callType === constants.callType.CHAT_PERSONAL_CODE || callType === constants.callType.VIDEO_PERSONAL_CODE) {  // callType이 Chat 또는 Video 일 경우 
    const data = {
      callType,
      calleePersonalCode
    }
    ui.showCallingDialog(callingDialogRejectCallHandler); 
    wss.sendPreOffer(data);
  }
}

// 2. 요청받은 Callee의 화면에 Chat 또는 Video 요청이 들어왔다는 UI를 띄움
export const handlePreOffer = (data) => {
  const { callType, callerSocketId } = data;

  connectedUserDetails = {
    socketId: callerSocketId,
    callType,
  };

  if (
    callType === constants.callType.CHAT_PERSONAL_CODE || 
    callType === constants.callType.VIDEO_PERSONAL_CODE
  ) {
    ui.showIncomingCallDialog(callType, acceptCallHandler, rejectCallHandler); // 수락 또는 거절 시 이벤트 함수까지 같이 전달
  };
};

// 3-1. Callee가 요청을 수락할 경우 동작하는 함수 
const acceptCallHandler = () => {
  console.log('call accepted');
  createPeerConnection();
  sendPreOfferAnswer(constants.preOfferAnswer.CALL_ACCEPTED); // Caller에게 수락했다고 전달함
  ui.showCallElements(connectedUserDetails.callType);
};

// 3-2. Callee가 요청을 거절할 경우 동작하는 함수 
const rejectCallHandler = () => {
  console.log('call rejected');
  sendPreOfferAnswer(constants.preOfferAnswer.CALL_REJECTED);
};

// Caller가 요청했는데, Caller가 Reject할 때 호출됨
const callingDialogRejectCallHandler =() => {
  console.log('rejecting the call');
};

const sendPreOfferAnswer = (preOfferAnswer) => {
  const data = {
    callerSocketId: connectedUserDetails.socketId,
    preOfferAnswer,
  }
  ui.removeAllDialog();
  wss.sendPreOfferAnswer(data);
}

// 4. Callee에게 수락 또는 거절의 응답 받은 Caller가 취해야할 동작을 나타내는 함수 
export const handlePreOfferAnswer = (data) => {
  const { preOfferAnswer } = data;
  ui.removeAllDialog();

  // 4-1. CALLEE가 접속 중이지 않음 
  if (preOfferAnswer === constants.preOfferAnswer.CALLEE_NOT_FOUND) {
    ui.showInfoDialog(preOfferAnswer);
    // show dialog that callee has not been found
  }

  // 4-2. CALLEE가 다른 용무 중
  if (preOfferAnswer === constants.preOfferAnswer.CALL_UNAVAILABLE) {
    ui.showInfoDialog(preOfferAnswer);
    // show dialog that callee is not able to connect
  }

  // 4-3. CALLEE가 거절함 
  if (preOfferAnswer === constants.preOfferAnswer.CALL_REJECTED) {
    ui.showInfoDialog(preOfferAnswer);
    // show dialog that call is rejected by the callee 
  }

  // 4-4. CALLEE가 수락함
  if (preOfferAnswer === constants.preOfferAnswer.CALL_ACCEPTED) {
    ui.showCallElements(connectedUserDetails.callType); // CHAT인지, VIDEO인지에 따라 화면 변경
    createPeerConnection(); // RTCPeerConnection 시작 (Caller 부터!!)

    // send webRTC Offer 
    sendWebRTCOffer();  // Callee에게 WebRTC Offer 전달 (SDP)
  }
}

// 5. 수락을 받은 Caller는 Callee에게 RTCPeerConnection 관련 SDP를 전달
const sendWebRTCOffer = async () => {
  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);
  wss.sendDataUsingWebRTCSignaling({
    connectedUserSocketId: connectedUserDetails.socketId,  // Callee Socket Id
    type: constants.webRTCSignaling.OFFER,
    offer: offer,
  });
};

// 6. 전달받은 SDP를 저장 후 자신의 SDP를 전달
export const handlerWebRTCOffer = async (data) => {
  await peerConnection.setRemoteDescription(data.offer);
  const answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answer);
  wss.sendDataUsingWebRTCSignaling({
    connectedUserSocketId: connectedUserDetails.socketId,
    type: constants.webRTCSignaling.ANSWER,
    answer: answer,
  });
};

// 7. 먼저 SDP를 요청했던 사람에게 다른 사람의 SDP 정보를 remoteDescription에 저장함
export const handleWebRTCAnswer = async (data) => {
  console.log('handling webRTC answer');
  await peerConnection.setRemoteDescription(data.answer);
}

// 8. WebRTCSignaling. OFFER 및 ANSWER를 완료 한 후 ICE CANDIDATE정보를 저장
export const handleWebRTCCandidate = async (data) => {
  try {
    await peerConnection.addIceCandidate(data.candidate);
  } catch (err) {
    console.error("error occured when trying to add received ice candidata", err);
  }
}

let screenSharingStream;


// 카메라 <-> 로컬 PC 화면 으로 전환 하기 
export const switchBetweenCameraAndScreenSharing = async (screenSharingActive) => {
  if (screenSharingActive) {
    const localStream = store.getState().localStream;
    const senders = peerConnection.getSenders();

    const sender = senders.find((sender) => {
      return (sender.track.kind === localStream.getVideoTracks()[0].kind);
    });

    if (sender) {
      sender.replaceTrack(localStream.getVideoTracks()[0]);
    }

    // stop screen sharing stream
    store.getState().screenSharingStream.getTracks().forEach((track) => track.stop());

    store.setScreenSharingActive(!screenSharingActive);
    ui.updateLocalVideo(localStream);

  } else {
    console.log('switching for screen sharing');
    try {
      screenSharingStream = await navigator.mediaDevices.getDisplayMedia({
        video: true
      });
      store.setScreenSharingStream(screenSharingStream);

      // replace track which sender is sending
      const senders = peerConnection.getSenders();

      const sender = senders.find((sender) => {
        return (sender.track.kind === screenSharingStream.getVideoTracks()[0].kind);
      });

      if (sender) {
        sender.replaceTrack(screenSharingStream.getVideoTracks()[0]);
      }

      store.setScreenSharingActive(!screenSharingActive);

      ui.updateLocalVideo(screenSharingStream);
    } catch (err) {
      console.error('error occured when trying to get screen sharing stream', err);
    }
  }
}