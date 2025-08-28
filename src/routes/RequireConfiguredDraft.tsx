import { ReactNode, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDraftStore } from '../store/draftStore';

export default function RequireConfiguredDraft({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const { teamCount, teams, baseBudget, templateRoster } = useDraftStore();

  useEffect(() => {
    const isConfigured = 
      teamCount > 0 &&
      baseBudget > 0 &&
      teams?.length === teamCount &&
      templateRoster &&
      Object.keys(templateRoster).length > 0;

    if (!isConfigured) {
      navigate('/');
    }
  }, [navigate, teamCount, baseBudget, teams, templateRoster]);

  return <>{children}</>;
}
