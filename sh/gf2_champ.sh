#!/bin/sh

TARGET=gf2
RUNNER=champ

cd $(dirname $(readlink $0))/..
NODE_ENV=$TARGET yarn start -r $RUNNER | ./node_modules/bunyan/bin/bunyan --color -o short
