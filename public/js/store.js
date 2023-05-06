import * as constants from './constants.js';

let state = {
  socketId: null,
  localStream: null,
  remoteStream: null,
  screenSharingStream: null,
  allowConnectionFromStrangers: false,
  screenSharingActive: false,
  callState: constants.callState.CALL_AVAILABLE_ONLY_CHAT,
};

export const setSocketId = (socketId) => {
  state = {
    ...state,
    socketId
  };
};

export const setLocalStream = (stream) => {
  state = {
    ...state,
    localStream: stream
  };
};

export const setAllowConnectionsFromStrangers = (allowConnection) => {
  state = {
    ...state,
    allowConnectionFromStrangers: allowConnection
  };
};

export const setScreenSharingActive = (screenSharingActive) => {
  state = {
    ...state,
    screenSharingActive,
  };
};

export const setScreenSharingStream = (stream) => {
  state = {
    ...state,
    screenSharingStream: stream
  };
};

export const setRemoteStream = (stream) => {
  state = {
    ...state,
    remoteStream: stream,
  };
};

export const getState = () => {
  return state;
};

export const setCallState = (callState) => {
  state = {
    ...state,
    callState,
  }
}