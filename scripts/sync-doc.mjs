// 把 console repo 的訂閱架構文件複製進來,供「訂閱架構設計」頁以 ?raw 內嵌。
// 原檔在另一個 repo,build 時無法直接參照,所以這裡保留一份副本 —— 原檔更新後跑這支。
import { copyFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const SOURCE = resolve(here, '../../../Git/console/docs/subscription/architecture.md');
const DEST = resolve(here, '../src/content/architecture.md');

if (!existsSync(SOURCE)) {
  console.error(`找不到來源文件:${SOURCE}`);
  console.error('若 console repo 不在預設位置,請直接手動複製到 src/content/architecture.md。');
  process.exit(1);
}
copyFileSync(SOURCE, DEST);
console.log(`已同步:${SOURCE}\n     -> ${DEST}`);
