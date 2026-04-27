import { chromium } from "playwright";
import path from "path";

const BASE = process.env.PW_BASE_URL || "http://127.0.0.1:3000";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

const errors = [];
page.on("console", (msg) => {
  if (msg.type() === "error") errors.push(msg.text());
});
page.on("pageerror", (err) => errors.push(String(err)));

try {
  await page.goto(BASE, { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForSelector("aside pre", { timeout: 15000 });

  console.log("✓ Page loaded");

  const title = await page.title();
  console.log("✓ Title:", title);

  const input = page.locator("footer input");
  const inputVisible = await input.isVisible();
  console.log(inputVisible ? "✓ Input visible" : "✗ Input not visible");

  await input.fill("hello mu/th/ur");
  console.log("✓ Typed message");

  const inputVal = await input.inputValue();
  console.log(inputVal === "hello mu/th/ur" ? "✓ Input value correct" : "✗ Input value wrong");

  await input.press("Enter");
  console.log("✓ Pressed Enter");

  await page.waitForTimeout(2000);

  const messages = await page.locator("main pre").allTextContents();
  console.log("✓ Messages in terminal:", messages.length);

  const hasUserMsg = messages.some(m => m.includes("hello mu/th/ur"));
  console.log(hasUserMsg ? "✓ User message appears in terminal" : "✗ User message not found");

  console.log("\nConsole errors:", errors.length ? errors.join("\n") : "none");

  await page.screenshot({ path: path.join(".cursor", "playwright-func-test.png"), fullPage: true });
  console.log("✓ Screenshot saved");
} catch (e) {
  console.error("FAIL:", String(e));
  if (errors.length) console.error("Errors:", errors.join("\n"));
  try {
    await page.screenshot({ path: path.join(".cursor", "playwright-error.png"), fullPage: true });
  } catch {}
  process.exitCode = 1;
} finally {
  await browser.close();
}