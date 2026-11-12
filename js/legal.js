// Licence, imprint and privacy text. Pure, so a test can tie what is shown on screen
// to what is actually in the LICENSE file.

export const LICENCE_ID = 'MIT';
export const LICENCE_HOLDER = 'Detronics LTD PTY';
export const LICENCE_YEAR = '2026';

export const legal = Object.freeze({
  licence: {
    title: 'Licence and terms',
    body: [
      `This tool is released under the ${LICENCE_ID} licence, copyright ${LICENCE_YEAR} ${LICENCE_HOLDER}. `
        + 'You may use, copy, modify and distribute it, including commercially, provided the copyright '
        + 'notice travels with it.',
      'It is provided as is, without warranty of any kind. Contrast ratios follow the WCAG 2.1 '
        + 'formula and will match any other conforming checker, but conformance of a finished design '
        + 'is a judgement about that design, not something this tool can certify on your behalf.',
      'Colour-emotion associations shown here are documented conventions, not measured effects. They '
        + 'are culturally specific and are intended as a starting expectation, not as evidence.',
    ],
  },

  privacy: {
    title: 'Imprint and privacy',
    body: [
      'Everything runs in your browser. No palette, image, colour or result is ever sent anywhere, '
        + 'because there is no server to send it to and no analytics, cookies or third-party scripts '
        + 'in the page.',
      'Your palettes are stored in this browser\'s local storage, on this device only. Clearing site '
        + 'data removes them. Saving writes a file to your own disk.',
      'A share link encodes the palette in the URL fragment - the part after the #. Fragments are '
        + 'never transmitted to a web server, so a link can be sent without the colours passing '
        + 'through anyone else\'s infrastructure. Whoever you send the link to can of course read it.',
      `Published by ${LICENCE_HOLDER}. Source and issues: github.com/detronics-apps/ContrastBench`,
    ],
  },

  accuracy: {
    title: 'How accurate is this',
    body: [
      'Contrast ratios are exact: the WCAG 2.1 definition is arithmetic, and black on white returns '
        + '21.00 to the digit.',
      'A known limit of that formula, worth carrying: it under-reports how poorly light text on '
        + 'mid-dark backgrounds actually reads. Treat a marginal pass at 4.6:1 as marginal rather '
        + 'than as a licence.',
      'Perceptual distance uses OKLab, which is a good model of how different two colours look but '
        + 'still a model. The thresholds for "collapses" and "distinct" are working conventions, '
        + 'chosen so the tool is useful, not thresholds from a standard.',
      'Colour-blindness simulation uses the Vienot single-plane projection. It models the three '
        + 'common dichromacies and not anomalous trichromacy, and real severity varies between '
        + 'people. It is good enough to catch a pair that collapses; it is not a clinical result.',
      'Allocation percentages are professional convention rather than measurement, and are offered '
        + 'as a starting ratio to argue with.',
    ],
  },
});

export const LEGAL_SECTIONS = Object.keys(legal);
