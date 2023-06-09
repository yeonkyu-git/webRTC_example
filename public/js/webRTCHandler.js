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
      ui.showVideoCallButtons();
      store.setCallState(constants.callState.CALL_AVAILABLE)
      store.setLocalStream(stream);
    }).catch((err) => {
      console.error('error occured when trying to get an access to camera', err);
    })
}

// 요청 수락 시 상대방과 Connection  (RTCPeerConnection)
const createPeerConnection = () => {
  // RTCPeerConnection 객체 생성 및 STUN서버에 질의 (configuration에는 STUN 서버 정보 있음)
  peerConnection = new RTCPeerConnection(configuration);  

  // DataChannel 생성 (채팅이나 파일 등을 전달 및 받을 수 있는 채널)
  dataChannel = peerConnection.createDataChannel('chat'); 

  // DataChannel 을 열어둠. 즉 항시 Data 받을 수 있음
  peerConnection.ondatachannel = (event) => {
    const dataChannel = event.channel;

    dataChannel.onopen = () => {
      console.log('peer connection is ready to receive data channel messages');
    }

    // 채팅 Data 받기 
    dataChannel.onmessage = (event) => {
      console.log('message came from data channel');
      const message = JSON.parse(event.data);  // 받은 채팅 Data Parsing 
      ui.appendMessage(message); // 받은 대화를 UI에 뿌려줌
    }
  }


  // ICE_CANDIDATE 교환 
  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      console.log("peerConnectiopn.onicecandidate :: Callee & Caller");
      console.log(event.candidate)
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
  store.setRemoteStream(remoteStream); // 나의 상태 정보 저장소 (store)에 상대방의 화면 정보 저장 
  ui.updateRemoteVideo(remoteStream); // 상대방 화면을 브라우저에 띄우기 위해 UI Update 

  // Remote Track (상대방 화면)이 등록되면 호출됨
  peerConnection.ontrack = (event) => {
    remoteStream.addTrack(event.track);
  };

  // 자신의 화면을 상대방에게 전달한다.
  if (connectedUserDetails.callType === constants.callType.VIDEO_PERSONAL_CODE || connectedUserDetails.callType == constants.callType.VIDEO_STRANGER) {
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

  // 특정 Callee에게 요청 
  if (callType === constants.callType.CHAT_PERSONAL_CODE || callType === constants.callType.VIDEO_PERSONAL_CODE) {  // callType이 Chat 또는 Video 일 경우 
    const data = {
      callType,
      calleePersonalCode
    }
    ui.showCallingDialog(callingDialogRejectCallHandler); 
    store.setCallState(constants.callState.CALL_UNAVAILABLE);
    wss.sendPreOffer(data);
  }

  // 아무나 요청
  if (callType === constants.callType.CHAT_STRANGER || callType === constants.callType.VIDEO_STRANGER) {
    const data = {
      callType,
      calleePersonalCode
    }

    // 현재 상태를 콜 받을 수 없는 상태로 변경 
    store.setCallState(constants.callState.CALL_UNAVAILABLE);

    // WebSocket을 통해 시그널링 서버에게 Offer 
    wss.sendPreOffer(data);
  }
}

// 2. 요청받은 Callee의 화면에 Chat 또는 Video 요청이 들어왔다는 UI를 띄움
export const handlePreOffer = (data) => {
  const { callType, callerSocketId } = data;

  // Callee가 전화를 받을 수 있는 상태인지 확인 
  if (!checkCallPossibility()) {
    return sendPreOfferAnswer(constants.preOfferAnswer.CALL_UNAVAILABLE, callerSocketId);
  }

  // Callee에서도 Caller의 정보를 저장 (socketId)
  connectedUserDetails = {
    socketId: callerSocketId,
    callType,
  };

  // Callee의 현재 상태를 콜 받을 수 없는 상태로 변경 
  store.setCallState(constants.callState.CALL_UNAVAILABLE);

  // 수락할지 안할지에 대한 UI 화면 호출
  if (
    callType === constants.callType.CHAT_PERSONAL_CODE || 
    callType === constants.callType.VIDEO_PERSONAL_CODE
  ) {
    ui.showIncomingCallDialog(callType, acceptCallHandler, rejectCallHandler); // 수락 또는 거절 시 이벤트 함수까지 같이 전달
  };

  if (callType === constants.callType.CHAT_STRANGER || callType === constants.callType.VIDEO_STRANGER) {
    createPeerConnection();
    sendPreOfferAnswer(constants.preOfferAnswer.CALL_ACCEPTED);
    ui.showCallElements(connectedUserDetails.callType);
  };
};

// 3-1. Callee가 요청을 수락할 경우 동작하는 함수 
const acceptCallHandler = () => {
  console.log('call accepted');
  createPeerConnection(); // RTCConnection을 맺음 
  sendPreOfferAnswer(constants.preOfferAnswer.CALL_ACCEPTED); // Caller에게 수락했다고 전달함
  ui.showCallElements(connectedUserDetails.callType); // 채팅 시 필요한 UI 호출 
};

// 3-2. Callee가 요청을 거절할 경우 동작하는 함수 
const rejectCallHandler = () => {
  console.log('call rejected');
  setIncomingCallSAvailable();
  sendPreOfferAnswer(constants.preOfferAnswer.CALL_REJECTED);
};

// Caller가 요청했는데, Caller가 Reject할 때 호출됨
const callingDialogRejectCallHandler =() => {
  const data = {
    connectedUserSocketId: connectedUserDetails.socketId
  }

  closePeerConnectionAndResetState();
  wss.sendUserHangUp(data);
};

const sendPreOfferAnswer = (preOfferAnswer, callerSocketId = null) => {

  const SocketId = callerSocketId ? callerSocketId : connectedUserDetails.socketId;
  const data = {
    callerSocketId: SocketId,
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
    setIncomingCallSAvailable();
    ui.showInfoDialog(preOfferAnswer);
    // show dialog that callee has not been found
  }

  // 4-2. CALLEE가 다른 용무 중
  if (preOfferAnswer === constants.preOfferAnswer.CALL_UNAVAILABLE) {
    setIncomingCallSAvailable();
    ui.showInfoDialog(preOfferAnswer);
    // show dialog that callee is not able to connect
  }

  // 4-3. CALLEE가 거절함 
  if (preOfferAnswer === constants.preOfferAnswer.CALL_REJECTED) {
    setIncomingCallSAvailable();
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
  console.log("sendWebRTCOffer ::  Caller");
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
  console.log("handleWebRTCCandidate :: ICE Candidates 정보 받음");
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

// 9. 채팅 및 화상채팅 끊기
// 9-1. 끊는 사람이 호출
export const handleHangUp = () => {
  const data = {
    connectedUserSocketId: connectedUserDetails.socketId
  }

  wss.sendUserHangUp(data);
  closePeerConnectionAndResetState();
};

// 9-1. 끊는 것을 받는 사람이 호출
export const handleConnectedUserHangedUp = () => {
  closePeerConnectionAndResetState();
};

const closePeerConnectionAndResetState = () => {
  if (peerConnection) {
    peerConnection.close();
    peerConnection = null;
  }

  // active mic and camera
  if (connectedUserDetails.callType === constants.callType.VIDEO_PERSONAL_CODE 
    || connectedUserDetails.callType == constants.callType.VIDEO_STRANGER) {

      store.getState().localStream.getVideoTracks()[0].enabled = true;
      store.getState().localStream.getAudioTracks()[0].enabled = true;    
  }

  ui.updateUIAfterHangUp(connectedUserDetails.callType);
  setIncomingCallSAvailable();
  connectedUserDetails = null;
}


const checkCallPossibility = (callType) => {
  const callState = store.getState().callState;

  console.log(callState)

  if (callState === constants.callState.CALL_AVAILABLE) {
    return true;
  };

  if (
    (callType === constants.callType.VIDEO_PERSONAL_CODE || callType === constants.callType.VIDEO_STRANGER) &&
    callState === constants.callState.CALL_AVAILABLE_ONLY_CHAT
  ) {
    return false;
  }

  return false;
}

const setIncomingCallSAvailable = () => {
  const localStream = store.getState().localStream;

  if (localStream) {
    store.setCallState(constants.callState.CALL_AVAILABLE);
  } else {
    store.setCallState(constants.callState.CALL_AVAILABLE_ONLY_CHAT);
  }
}