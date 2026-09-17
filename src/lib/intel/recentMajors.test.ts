import { beforeEach, describe, expect, it } from 'vitest';
import { pushRecentMajor, readRecentMajors } from './recentMajors';

describe('recentMajors', () => {
  beforeEach(() => window.localStorage.clear());

  it('starts empty', () => {
    expect(readRecentMajors()).toEqual([]);
  });

  it('keeps the newest first without duplicates', () => {
    pushRecentMajor('a');
    pushRecentMajor('b');
    pushRecentMajor('a');
    expect(readRecentMajors()).toEqual(['a', 'b']);
  });

  it('caps the list at five', () => {
    ['a', 'b', 'c', 'd', 'e', 'f'].forEach(pushRecentMajor);
    expect(readRecentMajors()).toEqual(['f', 'e', 'd', 'c', 'b']);
  });

  it('ignores corrupted storage', () => {
    window.localStorage.setItem('darb:intel:recent-majors', 'not json');
    expect(readRecentMajors()).toEqual([]);
  });
});
