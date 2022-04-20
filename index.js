
const qrcode = require('qrcode');
const WAWebJS = require('whatsapp-web.js');

const GROUP_ID = process.env.L33TBOT_GROUP_ID;
const QR_FILENAME = process.env.L33TBOT_QR_FILENAME || 'qr.png';

const DAY_MS = 1000 * 60 * 60 * 24; // 1 day in milliseconds

const client = new WAWebJS.Client({
  authStrategy: new WAWebJS.LocalAuth(),
});


let shutdownTimer = null;


/**
 * Quit after a little grace period
 * @param {number} code exit code
 */
function shutdown(code) {
  client.destroy().then(() => {
    setTimeout(() => {
      process.exit(code);
    }, 1000); // wait a little before finally closing
  });
}





/**
 * get message for specific l33t counter
 * @param {number} counter 
 */
function getMessageQuip(counter) {
  const messageTexts = [
    [0, `RIP STRÄHNE Sadge`],
    [1, `...alles fängt mal klein an`],
    [5, `'er Strähne...weiter so!`],
    [10, `'er Strähne...nice!`],
    [15, `'er Strähne...hype!`],
    [25, `'er Strähne! MEGAHYPE!`],
    [40, `'er Strähne...POGGERS!`],
    [50, `'er Strähne...MEGA POGGERS!`],
  ];
  
  const specialTexts = new Map([
    [10, `'er Strähne...so viel wie 10 Jähriger!`],
    [18, `'er Strähne...darauf erstmal nen Schnaps`],
    [30, `'er Strähne...endlich 30!`],
    [40, `'er Strähne! Fast so gut wie A von Stairs halten`],
    [50, `'er Strähne...Mohrenkopfbrötchen? FUFFZISCH`],
  ]);

  if (specialTexts.has(counter)) {
    return specialTexts.get(counter);
  }

  return messageTexts
    .sort((l, r) => r[0] - l[0]) // sort descending, so it's easier to iterate
    .find(([upTo]) => counter >= upTo)[1] || 'I bims kabott';
}


/**
 * @param {WAWebJS.Chat} chat 
 * @param {number} counter
 */
function reportResult(chat, counter) {
  console.log('L33t count:', counter);
  const finalMsg = `[L33T Bot]: ${counter}${getMessageQuip(counter)}`;
  console.log('Sending message:', finalMsg);
  chat.sendMessage(finalMsg).then(() => {
    setTimeout(() => shutdown(0), 5000);
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


client.on('qr', (qr) => {
  qrcode.toFile(QR_FILENAME, qr);
  console.log('received QR, please scan!');

  shutdownTimer = setTimeout(() => {
    console.log('timeout over, shutting down');
    client.destroy().then(() => shutdown(1));
  }, 1000 * 60 * 5); // 5 minutes
});


client.on('authenticated', () => {
  console.log('Authenticated!');
  if (shutdownTimer) {
    clearTimeout(shutdownTimer);
    shutdownTimer = null;
  }
});


client.on('ready', () => {
  console.log('client is ready!');
  client.getChatById(GROUP_ID).then((chat) => {
    countL33ts(chat);
  });
});


client.on('auth_failure', (msg) => {
  console.error('Authentication error!', msg);
  shutdown(1);
});


client.on('disconnected', (reason) => {
  console.log('Client was logged out', reason);
  shutdown(1);
});


client.initialize();

// test message quips
// for (let i = 0; i < 60; ++i) {
//   console.log(i, getMessageQuip(i));
// }
