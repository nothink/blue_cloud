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
