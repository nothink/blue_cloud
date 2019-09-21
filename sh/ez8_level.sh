#!/bin/sh

TARGET=ez8
RUNNER=study
STUDY_TARGET=level

cd $(dirname $(readlink $0))/..
NODE_ENV=$TARGET yarn start -r $RUNNER -s $STUDY_TARGET | ./node_modules/bunyan/bin/bunyan --color -o short
