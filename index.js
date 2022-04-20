
const qrcode = require('qrcode');
const WAWebJS = require('whatsapp-web.js');

const GROUP_ID = process.env.L33TBOT_GROUP_ID;
const QR_FILENAME = process.env.L33TBOT_QR_FILENAME || 'qr.png';

const DAY_MS = 1000 * 60 * 60 * 24; // 1 day in milliseconds

const client = new WAWebJS.Client({
  authStrategy: new WAWebJS.LocalAuth(),
});


let shutdownTimer = null;

client.on('qr', (qr) => {
  qrcode.toFile(QR_FILENAME, qr);
  console.log('received QR, please scan!');

  shutdownTimer = setTimeout(() => {
    console.log('timeout over, shutting down');
    client.destroy();
    process.exit(1);
  }, 1000 * 60 * 5); // 5 minutes
});


client.on('authenticated', () => {
  console.log('Authenticated!');
  if (shutdownTimer) {
    clearTimeout(shutdownTimer);
    shutdownTimer = null;
  }
});


/**
 * @param {WAWebJS.Chat} chat 
 * @param {number} counter
 */
function reportResult(chat, counter) {
  console.log('L33t count:', counter);
  let outMsg;
  if (counter > 1) {
    outMsg = `${counter}'er Strähne!`;
  } else if (counter === 1) {
    outMsg = `${counter}...alles fängt mal klein an`;
  } else if (counter === 2) {
    outMsg = `${counter}...weiter so!`;
  } else {
    outMsg = `RIP STRÄHNE Sadge`;
  }
  
  chat.sendMessage(`[L33T Bot]: ${outMsg}`).then(() => {
    setTimeout(() => {
      client.destroy();
      process.exit(0);
    }, 5000);
  });
}


/**
 * @param {WAWebJS.Chat} chat
 * @param {number} maxMsgCount
 */
function countL33ts(chat, maxMsgCount = 50) {
  chat.fetchMessages({limit: maxMsgCount}).then((messages) => {
    let day = new Date();
    let counter = 0;
    let l33tForDay = false;
    for (let msg of messages.reverse()) {
      const msgTime = new Date(msg.timestamp * 1000);

      // is this message already on the next day?
      if ((day - msgTime) > DAY_MS) {
        if (!l33tForDay) { // no leet for whole day? :(
          reportResult(chat, counter);
          return;
        }

        // roll over to next day
        day -= DAY_MS;
        l33tForDay = false;
      }
      
      // check for l33t messages if we haven't found one already,
      // otherwise just ignore the messages
      if (
        !l33tForDay &&
        msgTime.getHours() === 13 &&
        msgTime.getMinutes() === 37 &&
        msg.body.toLowerCase().includes('l33t')
      ) {
          // l33t found!
          counter += 1;
          l33tForDay = true;
      }
    }

    const nextMsgCount = Math.round(maxMsgCount * 1.5);
    console.log('not enough messages, trying again with ', nextMsgCount);
    countL33ts(chat, nextMsgCount);
  });
}


client.on('ready', () => {
  console.log('client is ready!');
  client.getChatById(GROUP_ID).then((chat) => {
    countL33ts(chat);
  });
});


client.on('auth_failure', (msg) => {
  console.error('Authentication error!', msg);
  process.exit(1);
});


client.on('disconnected', (reason) => {
  console.log('Client was logged out', reason);
});


client.initialize();
