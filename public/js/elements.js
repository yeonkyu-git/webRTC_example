// 화상전화나 채팅 요청이 들어올 경우 수락 또는 거절하는 화면 창 띄우는 함수
export const getIncomingCallDialog = (callTypeInfo, acceptCallHandler, rejectCallHandler) => {
  console.log('getting incoming call dialog');

  const dialog = document.createElement('div');
  dialog.classList.add('dialog_wrapper');
  const dialogContent = document.createElement('div');
  dialogContent.classList.add("dialog_content");
  dialog.appendChild(dialogContent);

  const title = document.createElement('p');
  title.classList.add('dialog_title');
  title.innerHTML = `Incoming ${callTypeInfo} call`;

  const imageContainer = document.createElement('div');
  imageContainer.classList.add('dialog_image_container');
  const image = document.createElement('img');
  const avatarImagePath = './utils/images/dialogAvatar.png';
  image.src = avatarImagePath;
  imageContainer.appendChild(image);

  const buttonContainer = document.createElement('div');
  buttonContainer.classList.add('dialog_button_container');

  const acceptCallButton = document.createElement('button');
  acceptCallButton.classList.add('dialog_accept_call_button');
  const acceptCallImage = document.createElement('img');
  acceptCallImage.classList.add('dialog_button_image');
  const acceptCallImgPath = './utils/images/acceptCall.png';
  acceptCallImage.src = acceptCallImgPath;
  acceptCallButton.append(acceptCallImage);
  buttonContainer.appendChild(acceptCallButton);

  const rejectCallButton = document.createElement('button');
  rejectCallButton.classList.add('dialog_reject_call_button');
  const rejectCallImage = document.createElement('img');
  rejectCallImage.classList.add('dialog_button_image');
  const rejectCallImgPath = './utils/images/rejectCall.png';
  rejectCallImage.src = rejectCallImgPath;
  rejectCallButton.append(rejectCallImage);
  buttonContainer.appendChild(rejectCallButton)


  dialogContent.appendChild(title);
  dialogContent.appendChild(imageContainer);
  dialogContent.appendChild(buttonContainer);

  // 요청 수락 시 이벤트 동작 
  acceptCallButton.addEventListener('click', () => {
    acceptCallHandler();
  })

  // 요청 거절 시 이벤트 동작
  rejectCallButton.addEventListener('click', () => {
    rejectCallHandler();
  })

  return dialog;
};


export const getCallingDialog = (rejectCallHandler) => {
  const dialog = document.createElement('div');
  dialog.classList.add('dialog_wrapper');
  const dialogContent = document.createElement('div');
  dialogContent.classList.add("dialog_content");
  dialog.appendChild(dialogContent);

  const title = document.createElement('p');
  title.classList.add('dialog_title');
  title.innerHTML = `Calling`;

  const imageContainer = document.createElement('div');
  imageContainer.classList.add('dialog_image_container');
  const image = document.createElement('img');
  const avatarImagePath = './utils/images/dialogAvatar.png';
  image.src = avatarImagePath;
  imageContainer.appendChild(image);

  const buttonContainer = document.createElement('div');
  buttonContainer.classList.add('dialog_button_container');

  const hangUpCallButton = document.createElement('button');
  hangUpCallButton.classList.add('dialog_reject_call_button');
  const hangUpCallImage = document.createElement('img');
  hangUpCallImage.classList.add('dialog_button_image');
  const hangUpCallImgPath = './utils/images/rejectCall.png';
  hangUpCallImage.src = hangUpCallImgPath;
  hangUpCallButton.append(hangUpCallImage);
  buttonContainer.appendChild(hangUpCallButton)


  dialogContent.appendChild(title);
  dialogContent.appendChild(imageContainer);
  dialogContent.appendChild(buttonContainer);
  return dialog;
}

export const getInfoDialog = (dialogTitle, dialogDescription) => {
  const dialog = document.createElement('div');
  dialog.classList.add('dialog_wrapper');
  const dialogContent = document.createElement('div');
  dialogContent.classList.add("dialog_content");
  dialog.appendChild(dialogContent);

  const title = document.createElement('p');
  title.classList.add('dialog_title');
  title.innerHTML = dialogTitle;

  const imageContainer = document.createElement('div');
  imageContainer.classList.add('dialog_image_container');
  const image = document.createElement('img');
  const avatarImagePath = './utils/images/dialogAvatar.png';
  image.src = avatarImagePath;
  imageContainer.appendChild(image);

  const description = document.createElement('p');
  description.classList.add('dialog_description');
  description.innerHTML = dialogDescription;

  dialogContent.appendChild(title);
  dialogContent.appendChild(imageContainer);
  dialogContent.appendChild(description);

  return dialog;
}