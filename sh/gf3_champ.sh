#!/bin/sh

TARGET=gf3
RUNNER=champ

cd $(dirname $(readlink $0))/..
NODE_ENV=$TARGET yarn start -r $RUNNER | ./node_modules/bunyan/bin/bunyan --color -o short
