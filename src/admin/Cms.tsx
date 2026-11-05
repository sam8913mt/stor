import { useState } from 'react';
import { CmsPages } from './Simple';
import { HOME, SettingsForm } from './SettingsForm';
import { Can, PageHead } from './ui';
import { tr } from '../i18n';

export default function AdminCms() {
  const [tab, setTab] = useState<'pages' | 'home'>('pages');
  return (
    <Can perm="cms.manage">
      <PageHead title={tr('aCms.1', 'محتوا (CMS)')}>
        <div className="tabs"><button className={tab === 'pages' ? 'is-on' : ''} onClick={() => setTab('pages')}>{tr('aCms.2', 'صفحات')}</button><button className={tab === 'home' ? 'is-on' : ''} onClick={() => setTab('home')}>{tr('aCms.3', 'صفحه اصلی')}</button></div>
      </PageHead>
      {tab === 'pages' ? <CmsPages /> : <SettingsForm fields={HOME} />}
    </Can>
  );
}
