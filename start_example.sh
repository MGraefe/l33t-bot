#!/bin/bash

# always update, maybe WA Web changes quite rapidly...
npm update

export L33TBOT_GROUP_ID="12345678910-12345678910@g.us"
export L33TBOT_QR_FILENAME="/var/www/mysecretfolder/qr.png"

npm start
