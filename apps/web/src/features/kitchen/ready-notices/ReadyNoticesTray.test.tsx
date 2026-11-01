import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { mockReadyNotices, readyNotice, recordKitchenPosts } from '../../../../tests/msw/kitchen-handlers';
import { fakeRealtime } from '../../../../tests/realtime';
import { renderRoutes } from '../../../../tests/render';
import { RealtimeProvider } from '../../../lib/realtime-context';
import { ReadyNoticesTray } from './ReadyNoticesTray';

function renderTray() {
  const realtime = fakeRealtime();
  renderRoutes(
    [
      {
        path: '/mozo',
        element: (
          <RealtimeProvider value={realtime.state}>
            <ReadyNoticesTray />
          </RealtimeProvider>
        ),
      },
    ],
    '/mozo',
  );
  return realtime;
}

const NOTICE_TEXT = 'Mesa 5: 2 × Ají de gallina — listo';

describe('Feature 004 — avisos de plato listo del mozo', () => {
  it('[004] AC-3.1: el aviso "Mesa 5: 2 × Ají de gallina — listo" aparece sin recargar', async () => {
    let notices = [] as ReturnType<typeof readyNotice>[];
    mockReadyNotices(() => notices);
    const realtime = renderTray();
    await waitFor(() => {
      expect(screen.queryByText(NOTICE_TEXT)).not.toBeInTheDocument();
    });

    const notice = readyNotice(1);
    notices = [notice];
    realtime.emit('kitchen:ready-notice', notice);

    expect(await screen.findByText(NOTICE_TEXT)).toBeInTheDocument();
  });

  it('[004] AC-3.2: "Visto" quita el aviso y lo informa a la API', async () => {
    const notice = readyNotice(1);
    let notices = [notice];
    mockReadyNotices(() => notices);
    const posts = recordKitchenPosts(() => {
      notices = [];
      return new Response(null, { status: 204 });
    });
    renderTray();

    await userEvent.setup().click(await screen.findByRole('button', { name: 'Visto' }));

    await waitFor(() => {
      expect(screen.queryByText(NOTICE_TEXT)).not.toBeInTheDocument();
    });
    expect(posts).toEqual([{ path: `/api/kitchen/ready-notices/${notice.id}/seen`, body: undefined }]);
  });
});
