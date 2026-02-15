jest.mock("../../src/config", () => ({
  config: {
    pairingExpiry: 10 * 60 * 1000, // 10 minutes
  },
}));

import {
  generatePairingCode,
  validatePairingCode,
} from "../../src/auth/pairing";

describe("pairing", () => {
  describe("generatePairingCode", () => {
    it("should return a 6-digit string", () => {
      const code = generatePairingCode();
      expect(code).toMatch(/^\d{6}$/);
    });

    it("should generate different codes on subsequent calls", () => {
      const codes = new Set<string>();
      for (let i = 0; i < 20; i++) {
        codes.add(generatePairingCode());
      }
      // With 6 digits, 20 codes should have at least a few unique values
      expect(codes.size).toBeGreaterThan(1);
    });
  });

  describe("validatePairingCode", () => {
    it("should accept the correct code", () => {
      const code = generatePairingCode();
      expect(validatePairingCode(code)).toBe(true);
    });

    it("should reject an incorrect code", () => {
      generatePairingCode();
      expect(validatePairingCode("000000")).toBe(false);
    });

    it("should invalidate code after successful use (one-time use)", () => {
      const code = generatePairingCode();
      expect(validatePairingCode(code)).toBe(true);
      // Second use of same code should fail
      expect(validatePairingCode(code)).toBe(false);
    });

    it("should reject when no code has been generated", () => {
      // Generate and consume
      const code = generatePairingCode();
      validatePairingCode(code);
      // Now there's no active code
      expect(validatePairingCode("123456")).toBe(false);
    });

    it("should replace the previous code when generating a new one", () => {
      const code1 = generatePairingCode();
      const code2 = generatePairingCode();
      // Old code should be invalid
      expect(validatePairingCode(code1)).toBe(false);
      // New code should work (generate fresh since code1 validation consumed it)
      const code3 = generatePairingCode();
      expect(validatePairingCode(code3)).toBe(true);
    });

    it("should reject an expired code", () => {
      const code = generatePairingCode();

      // Fast-forward time past expiry
      const originalNow = Date.now;
      Date.now = () => originalNow() + 11 * 60 * 1000; // 11 minutes later

      expect(validatePairingCode(code)).toBe(false);

      Date.now = originalNow;
    });
  });
});
