import {
  AUTH_EMAIL_PARSER,
  EmailParserFn,
  defaultAuthEmailParser,
} from '@app-galaxy/auth-api';
import { Provider } from '@nestjs/common';

/** Auth e-mails (reset, verification): default galaxy parser plus our logo. */
const appEmailParser: EmailParserFn = (html, keyName, options, dataSource?) => {
  html = defaultAuthEmailParser(html, keyName, options, dataSource);
  const logoUrl = `${options.baseUrl}/assets/images/logo.png`;
  return html.replace('[LOGO]', logoUrl);
};

export const API_EMAIL_PARSER_PROVIDER: Provider = {
  provide: AUTH_EMAIL_PARSER,
  useValue: appEmailParser,
};
