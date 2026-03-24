import { describe, it, expect } from 'vitest';
import { validateUrl } from '../../src/utils/url-validator.js';

describe('validateUrl', () => {
  it('accepts http URLs', () => {
    expect(() => validateUrl('http://example.com')).not.toThrow();
  });

  it('accepts https URLs', () => {
    expect(() => validateUrl('https://example.com/path?q=1')).not.toThrow();
  });

  it('accepts file URLs', () => {
    expect(() => validateUrl('file:///tmp/test.html')).not.toThrow();
  });

  it('rejects data: URLs', () => {
    expect(() => validateUrl('data:text/html,<h1>hi</h1>')).toThrow(/Disallowed URL scheme/);
  });

  it('rejects javascript: URLs', () => {
    expect(() => validateUrl('javascript:alert(1)')).toThrow(/Disallowed URL scheme/);
  });

  it('rejects ftp: URLs', () => {
    expect(() => validateUrl('ftp://example.com')).toThrow(/Disallowed URL scheme/);
  });

  it('rejects localhost', () => {
    expect(() => validateUrl('http://localhost:3000')).toThrow(/Disallowed hostname/);
  });

  it('rejects 127.0.0.1', () => {
    expect(() => validateUrl('http://127.0.0.1')).toThrow(/Private.*IP/);
  });

  it('rejects AWS IMDS endpoint', () => {
    expect(() => validateUrl('http://169.254.169.254/latest/meta-data/')).toThrow(/Private.*IP/);
  });

  it('rejects 10.x private IPs', () => {
    expect(() => validateUrl('http://10.0.0.1')).toThrow(/Private.*IP/);
  });

  it('rejects 172.16.x private IPs', () => {
    expect(() => validateUrl('http://172.16.0.1')).toThrow(/Private.*IP/);
  });

  it('rejects 192.168.x private IPs', () => {
    expect(() => validateUrl('http://192.168.1.1')).toThrow(/Private.*IP/);
  });

  it('rejects 0.0.0.0', () => {
    expect(() => validateUrl('http://0.0.0.0')).toThrow(/Disallowed hostname/);
  });

  it('rejects invalid URLs', () => {
    expect(() => validateUrl('not-a-url')).toThrow(/Invalid URL/);
  });

  it('accepts legitimate public URLs', () => {
    expect(() => validateUrl('https://www.google.com')).not.toThrow();
    expect(() => validateUrl('https://example.org:8080/path')).not.toThrow();
  });
});
