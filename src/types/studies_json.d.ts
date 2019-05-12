declare module '*json/studies.json' {
  export interface StudyInfo {
    type: string;
    index: number;
    id: string;
    cost: number;
    deck: number;
    name: string;
  }

  class Studies {
    [index: string]: StudyInfo;
  }

  const value: Studies;
  export default value;
}
