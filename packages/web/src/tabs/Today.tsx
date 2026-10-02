import type { ReturnReport, ViewState } from '@lotg/protocol';

import type { Actions } from '../components/actions';
import { ColdBanner, FamineBanner, OfflineBanner } from '../components/Banners';
import { Header } from '../components/Header';
import { Today } from '../components/Today';

/** A aba Hoje: o Relatório de Retorno e as decisões pendentes (GDD §2.3). */
export function TodayTab(props: {
  view: ViewState;
  elapsed: number;
  online: boolean;
  retryInSeconds: number | null;
  report: ReturnReport | null;
  actions: Actions;
}) {
  return (
    <div class="panel">
      <Header view={props.view} elapsed={props.elapsed} />
      <OfflineBanner
        online={props.online}
        retryInSeconds={props.retryInSeconds}
        actions={props.actions}
      />
      <FamineBanner famine={props.view.famine} notes={props.view.morale.notes} />
      <ColdBanner winter={props.view.winter} />
      <Today report={props.report} view={props.view} actions={props.actions} />
    </div>
  );
}
