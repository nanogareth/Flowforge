import fs from "fs";
import path from "path";
import os from "os";

// Use a temp directory for each test run so we don't touch real keys
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ff-jwt-test-"));

jest.mock("../../src/config", () => ({
  config: {
    secretDir: tmpDir,
    jwtExpiry: 60, // 1 minute for tests
  },
}));

import { sign, verify } from "../../src/auth/jwt";

afterAll(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe("jwt", () => {
  describe("sign + verify round-trip", () => {
    it("should produce a valid token that can be verified", () => {
      const payload = { paired: true, pairedAt: Date.now() };
      const token = sign(payload);
      expect(typeof token).toBe("string");
      expect(token.split(".")).toHaveLength(3);

      const decoded = verify(token);
      expect(decoded.paired).toBe(true);
      expect(decoded.pairedAt).toBe(payload.pairedAt);
    });

    it("should include exp claim", () => {
      const token = sign({ test: true });
      const decoded = verify(token);
      expect(decoded.exp).toBeDefined();
      expect(decoded.iat).toBeDefined();
    });
  });

  describe("verify", () => {
    it("should reject a tampered token", () => {
      const token = sign({ data: "original" });
      const tampered = token.slice(0, -4) + "XXXX";
      expect(() => verify(tampered)).toThrow();
    });

    it("should reject a completely invalid string", () => {
      expect(() => verify("not-a-token")).toThrow();
    });

    it("should reject an empty string", () => {
      expect(() => verify("")).toThrow();
    });
  });

  describe("secret persistence", () => {
    it("should write secret.key to the configured directory", () => {
      // sign triggers getSecret which creates the file
      sign({ init: true });
      const keyPath = path.join(tmpDir, "secret.key");
      expect(fs.existsSync(keyPath)).toBe(true);
      const contents = fs.readFileSync(keyPath, "utf-8");
      expect(contents.length).toBeGreaterThan(0);
    });

    it("should reuse the same secret across calls", () => {
      const token1 = sign({ a: 1 });
      const token2 = sign({ b: 2 });
      // Both should be verifiable (same secret)
      expect(verify(token1).a).toBe(1);
      expect(verify(token2).b).toBe(2);
    });
  });
});
