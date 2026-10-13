import { useEffect, useState } from "react";

/** 값이 바뀐 뒤 잠시 가만히 있을 때만 따라가는 값. 입력할 때마다 쪽 나누기를 다시 하지 않으려고 쓴다. */
export function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}
