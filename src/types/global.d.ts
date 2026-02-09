interface PerceptrBugEntry {
  bugId: string;
  timestamp: number;
  description: string;
  page: string;
}

declare global {
  interface Window {
    __PERCEPTR_TEST_BUGS__: PerceptrBugEntry[];
  }
}

export {};
