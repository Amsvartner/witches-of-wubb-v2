const updateIndex = <T>(index: number, newValue: T, initialArray: T[]): T[] => {
  const newArray = [...initialArray];
  newArray[index] = newValue;
  return newArray;
};

export const ContextUtils = { updateIndex };
