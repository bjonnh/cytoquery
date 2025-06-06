declare module 'accessor-fn' {
  type AccessorFn = <In = any, Out = any>(
    accessor: Out | string | ((obj: In) => Out)
  ) => (obj: In) => Out;
  
  const accessorFn: AccessorFn;
  export default accessorFn;
}