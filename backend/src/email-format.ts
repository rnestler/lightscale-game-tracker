import MarkdownIt from 'markdown-it';

const markdown = new MarkdownIt({ html: false, linkify: true, breaks: true });

const EMAIL_LANGUAGE = 'en';
const FONT_STACK = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

export function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function emailLayout(content: string): string {
  return `<!doctype html>
<html lang="${EMAIL_LANGUAGE}">
<body style="margin:0;padding:0;background-color:#f5f5f4;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f5f4;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;width:100%;">
          <tr>
            <td style="background-color:#ffffff;border:1px solid #e7e5e4;border-radius:14px;padding:40px;font-family:${FONT_STACK};font-size:15px;line-height:24px;color:#44403c;">
              ${content}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function renderEmailHtml(body: string, html: string): string {
  return html === '' ? emailLayout(markdown.render(body)) : html;
}
