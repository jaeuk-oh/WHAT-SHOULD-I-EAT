/** 레시피 제목은 URL 경로 세그먼트로 쓰인다. 인코딩 규칙을 한 곳에 모아 둔다. */
export function recipePath(title: string): string {
  return `/recipes/${encodeURIComponent(title)}`;
}
