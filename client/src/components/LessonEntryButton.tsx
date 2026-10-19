import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Video } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { lessonJoinPath } from '@shared/lesson-links';
export function LessonEntryButton({lesson}:{lesson:{id:number;starts_at:string;ends_at:string;status:string}}) {
  const {user}=useAuth();const {t,i18n}=useTranslation();
  const query=useQuery({queryKey:['lesson-entry',lesson.id,user?.id,lesson.starts_at,lesson.status],enabled:Boolean(user&&lesson.status==='scheduled'),queryFn:async()=>{
    const response=await fetch(`/api/lessons/${lesson.id}/entry-status`,{credentials:'include'});
    if(!response.ok)throw Error('unavailable');return response.json() as Promise<{available:boolean}>;
  },refetchInterval:15000,refetchIntervalInBackground:false});
  if(lesson.status!=='scheduled')return null;
  if(query.isPending)return <p role="status">{t('p4.loading')}</p>;
  if(query.isError)return <p role="alert">{t('lessonMail.unavailable')} <button className="p4-control" onClick={()=>void query.refetch()}>{t('p4.retry')}</button></p>;
  return query.data?.available?<a className="p4-button lesson-entry-button" href={lessonJoinPath(lesson.id,lesson.starts_at,i18n.language.split('-')[0])} target="_blank" rel="noopener noreferrer"><Video size={19} aria-hidden="true" />{t('dashboardUpdate.startLesson')}</a>:<p className="p4-muted">{t('lessonMail.unavailable')}</p>;
}
