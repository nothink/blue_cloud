import RunnerBase from './RunnerBase';
// import { Type, Sphere } from './Sphere'
import * as list from '../../studylist.json';

const studyInfos = list;

export class StudyRunner extends RunnerBase {
    readonly infos = studyInfos;
    usingSpark: boolean;
    usingSkill: boolean;

    constructor() {
        super();
        this.usingSpark = this.conf.study.usingSpark;
        this.usingSkill = this.conf.study.usingSkill;
    }

    runOnce() {
        console.log(this.usingSpark);
        console.log(this.usingSkill);
//        console.log(this.infos);
//        this.logger.info('jo');
    }
}
