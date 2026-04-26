describe('Scrobble song (timestamp increment)', () => {
  beforeEach(() => {
    cy.clearLocalStorage();
    cy.clearCookies();

    cy.intercept('GET', '/api/v2/user.php', { fixture: 'api/v2/user/authenticated.json' }).as('userData');
    cy.intercept('GET', '/api/v2/settings.php', { fixture: 'api/v2/settings/authenticated.json' }).as('settings');
    cy.intercept('POST', '/api/v2/scrobble.php', { fixture: 'api/v2/scrobble/success.json' }).as('scrobbleData');

    cy.visit('/scrobble/song');
    cy.get('[data-cy="SongForm"]').should('be.visible');
  });

  it('shows increment checkbox only when custom timestamp is selected', () => {
    cy.get('[data-cy="timestampMode-now"]').should('have.class', 'active');
    cy.get('[data-cy="SongForm-trackLengthFetching"]').should('not.exist');

    cy.get('[data-cy="timestampMode-custom"]').click();
    cy.get('[data-cy="SongForm-trackLengthFetching"]').should('exist').and('be.checked');

    cy.get('[data-cy="timestampMode-now"]').click();
    cy.get('[data-cy="SongForm-trackLengthFetching"]').should('not.exist');
  });

  it('increments timestamp by track length when fetching is enabled', () => {
    const artist = 'Arctic Monkeys';
    const title = 'Do I Wanna Know?';
    const duration = 272000; // 272 seconds in ms

    cy.intercept('GET', '**/2.0/?*method=track.getInfo*', {
      body: {
        track: {
          duration: duration.toString(),
        },
      },
    }).as('trackInfo');

    cy.get('[data-cy="timestampMode-custom"]').click();

    // Check initial time is 12:00:00 (from cy.clock)
    // Note: The browser might display this in local time, but cy.clock should make it consistent.
    // Let's just read whatever is there and check the difference.
    cy.get('[data-cy="DateTimePicker-time"]').invoke('val').then((initialTime) => {
      cy.get('[data-cy="SongForm-artist"]').type(artist);
      cy.get('[data-cy="SongForm-title"]').type(title);

      cy.get('[data-cy="scrobble-button"]').click();
      cy.wait('@scrobbleData');

      // Wait for track info fetch. It might be called twice (once by SongForm, once by scrobbleActions for cover)
      // but they should both return the same mocked body.
      cy.wait('@trackInfo');

      const [h, m, s] = initialTime.split(':').map(Number);
      let expectedSeconds = h * 3600 + m * 60 + s + (duration / 1000);

      const expectedH = Math.floor(expectedSeconds / 3600) % 24;
      expectedSeconds %= 3600;
      const expectedM = Math.floor(expectedSeconds / 60);
      const expectedS = Math.floor(expectedSeconds % 60);

      const pad = (n) => n.toString().padStart(2, '0');
      const expectedTime = `${pad(expectedH)}:${pad(expectedM)}:${pad(expectedS)}`;

      cy.get('[data-cy="DateTimePicker-time"]').should('have.value', expectedTime);
    });
  });

  it('increments timestamp by default duration when fetching is disabled', () => {
    const artist = 'Arctic Monkeys';
    const title = 'R U Mine?';

    cy.get('[data-cy="timestampMode-custom"]').click();
    cy.get('[data-cy="SongForm-trackLengthFetching"]').uncheck();

    cy.get('[data-cy="DateTimePicker-time"]').invoke('val').then((initialTime) => {
      cy.get('[data-cy="SongForm-artist"]').type(artist);
      cy.get('[data-cy="SongForm-title"]').type(title);

      cy.get('[data-cy="scrobble-button"]').click();
      cy.wait('@scrobbleData');

      // DEFAULT_SONG_DURATION is 180s
      const [h, m, s] = initialTime.split(':').map(Number);
      let expectedSeconds = h * 3600 + m * 60 + s + 180;

      const expectedH = Math.floor(expectedSeconds / 3600) % 24;
      expectedSeconds %= 3600;
      const expectedM = Math.floor(expectedSeconds / 60);
      const expectedS = Math.floor(expectedSeconds % 60);

      const pad = (n) => n.toString().padStart(2, '0');
      const expectedTime = `${pad(expectedH)}:${pad(expectedM)}:${pad(expectedS)}`;

      cy.get('[data-cy="DateTimePicker-time"]').should('have.value', expectedTime);
    });
  });

  it('increments timestamp by default duration when fetching fails', () => {
    const artist = 'Arctic Monkeys';
    const title = 'Unknown Track';

    // Intercept track.getInfo and return error
    cy.intercept('GET', '**/2.0/?*method=track.getInfo*', {
      body: {
        error: 6,
        message: 'Track not found',
      },
    }).as('trackInfoFail');

    cy.get('[data-cy="timestampMode-custom"]').click();

    cy.get('[data-cy="DateTimePicker-time"]').invoke('val').then((initialTime) => {
      cy.get('[data-cy="SongForm-artist"]').type(artist);
      cy.get('[data-cy="SongForm-title"]').type(title);

      cy.get('[data-cy="scrobble-button"]').click();
      cy.wait('@scrobbleData');

      // We might need to wait for the failed request to complete
      cy.wait('@trackInfoFail');

      // Should still increment by default 180s
      const [h, m, s] = initialTime.split(':').map(Number);
      let expectedSeconds = h * 3600 + m * 60 + s + 180;

      const expectedH = Math.floor(expectedSeconds / 3600) % 24;
      expectedSeconds %= 3600;
      const expectedM = Math.floor(expectedSeconds / 60);
      const expectedS = Math.floor(expectedSeconds % 60);

      const pad = (n) => n.toString().padStart(2, '0');
      const expectedTime = `${pad(expectedH)}:${pad(expectedM)}:${pad(expectedS)}`;

      cy.get('[data-cy="DateTimePicker-time"]').should('have.value', expectedTime);
    });
  });
});
