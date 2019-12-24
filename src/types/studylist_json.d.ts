// TODO: JSON読み込みを可及的速やかに直す
// https://qiita.com/oganyanATF/items/65dfcc4dd25c028ea403

declare module '*studylist.json' {
  interface StudyInfo {
    type: string;
    index: number;
    id: string;
    cost: number;
    deck: number;
    name: string;
  }

  const value: { [index: string]: StudyInfo };
  export default value;
}
