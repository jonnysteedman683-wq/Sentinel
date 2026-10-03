import React, { useState, useEffect } from 'react';
import { googleSignIn, cachedAccessToken, firebaseSignOut } from '../firebase.js';
import { Calendar, Mail, FileText, CheckSquare, Loader2, LogOut, Search, StickyNote, Users, MessageSquare, FolderSearch, Database, RefreshCw } from 'lucide-react';
import { getAuth } from 'firebase/auth';

declare global {
  interface Window {
    gapi: any;
  }
  const google: any;
}

export const ExecutiveIntegrationNode: React.FC<{ theme: string }> = ({ theme }) => {
  const [token, setToken] = useState<string | null>(cachedAccessToken);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [tasks, setTasks] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [emails, setEmails] = useState<any[]>([]);
  const [docs, setDocs] = useState<any[]>([]);
  const [notes, setNotes] = useState<any[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [spaces, setSpaces] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [pickerLoaded, setPickerLoaded] = useState(false);

  useEffect(() => {
    // Load the Google Picker API script
    if (!window.gapi) {
      const script = document.createElement('script');
      script.src = 'https://apis.google.com/js/api.js';
      script.onload = () => {
        window.gapi.load('picker', {
          callback: () => setPickerLoaded(true)
        });
      };
      document.body.appendChild(script);
    } else {
      window.gapi.load('picker', {
        callback: () => setPickerLoaded(true)
      });
    }
  }, []);

  const [ragStatus, setRagStatus] = useState<any>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  const fetchRagStatus = async () => {
    try {
      const res = await fetch('/api/knowledge/status');
      const data = await res.json();
      setRagStatus(data);
    } catch (e) {
      console.error("Failed to fetch RAG status", e);
    }
  };

  const handleManualSync = async () => {
    setIsSyncing(true);
    try {
      const res = await fetch('/api/knowledge/sync', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        fetchRagStatus();
      }
    } catch (e) {
      console.error("Manual sync failed", e);
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    fetchRagStatus();
  }, []);

  const openPicker = () => {
    if (!pickerLoaded || !token) return;
    const view = new google.picker.DocsView(google.picker.ViewId.DOCS);
    const picker = new google.picker.PickerBuilder()
      .addView(view)
      .setOAuthToken(token)
      .setDeveloperKey('') // Not strictly required if token has drive scopes usually, or we can just omit it
      .setCallback((data: any) => {
        if (data.action === google.picker.Action.PICKED) {
          const doc = data.docs[0];
          console.log('Picked file:', doc);
          alert(`Selected: ${doc.name}`);
        }
      })
      .build();
    picker.setVisible(true);
  };

  useEffect(() => {
    // Check if we have a token initially (might be set by another component)
    setToken(cachedAccessToken);
  }, []);

  const handleLogin = async () => {
    setIsLoggingIn(true);
    try {
      const result = await googleSignIn();
      if (result) {
        setToken(result.accessToken);
      }
    } catch (err) {
      console.error('Login failed:', err);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    await firebaseSignOut(getAuth());
    setToken(null);
  };

  const fetchWorkspaceData = async () => {
    if (!token) return;
    setLoadingData(true);
    try {
      // Fetch Tasks
      const tasksRes = await fetch('https://tasks.googleapis.com/tasks/v1/users/@me/lists', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const taskLists = await tasksRes.json();
      if (taskLists.items && taskLists.items.length > 0) {
        const firstListId = taskLists.items[0].id;
        const tasksListRes = await fetch(`https://tasks.googleapis.com/tasks/v1/lists/${firstListId}/tasks?maxResults=5`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const tasksData = await tasksListRes.json();
        setTasks(tasksData.items || []);
      }

      // Fetch Calendar Events
      const now = new Date().toISOString();
      const calRes = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${now}&maxResults=5&singleEvents=true&orderBy=startTime`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const calData = await calRes.json();
      setEvents(calData.items || []);

      // Fetch Gmail (recent 5)
      const gmailRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=5&q=in:inbox', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const gmailData = await gmailRes.json();
      if (gmailData.messages) {
        const emailDetails = await Promise.all(gmailData.messages.map(async (msg: any) => {
          const detailRes = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          return await detailRes.json();
        }));
        setEmails(emailDetails);
      }
      
      // Fetch Docs (Drive API filtering by mimeType for docs)
      const docsRes = await fetch('https://www.googleapis.com/drive/v3/files?q=mimeType="application/vnd.google-apps.document"&orderBy=viewedByMeTime desc&pageSize=5&fields=files(id,name,viewedByMeTime)', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const docsData = await docsRes.json();
      setDocs(docsData.files || []);

      // Fetch Keep Notes
      try {
        const keepRes = await fetch('https://keep.googleapis.com/v1/notes?pageSize=5', {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (keepRes.ok) {
          const keepData = await keepRes.json();
          setNotes(keepData.notes || []);
        }
      } catch (err) {
        console.warn('Keep API error or not enabled', err);
      }

      // Fetch Contacts
      try {
        const peopleRes = await fetch('https://people.googleapis.com/v1/people/me/connections?personFields=names,emailAddresses&pageSize=5', {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (peopleRes.ok) {
          const peopleData = await peopleRes.json();
          setContacts(peopleData.connections || []);
        }
      } catch (err) {
        console.warn('People API error or not enabled', err);
      }

      // Fetch Chat Spaces
      try {
        const chatRes = await fetch('https://chat.googleapis.com/v1/spaces?pageSize=5', {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (chatRes.ok) {
          const chatData = await chatRes.json();
          setSpaces(chatData.spaces || []);
        }
      } catch (err) {
        console.warn('Chat API error or not enabled', err);
      }
      
    } catch (err) {
      console.error('Failed to fetch workspace data:', err);
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchWorkspaceData();
    }
  }, [token]);

  if (!token) {
    return (
      <div className={`p-6 rounded-xl border flex flex-col items-center justify-center min-h-[300px] ${theme === 'dark' ? 'bg-black/40 border-white/10' : 'bg-white border-slate-200'}`}>
        <div className="w-16 h-16 bg-blue-500/10 rounded-full flex items-center justify-center mb-4">
          <LogOut className="w-8 h-8 text-blue-400" />
        </div>
        <h3 className="text-xl font-bold mb-2">Workspace Integration</h3>
        <p className="text-sm text-slate-400 text-center max-w-sm mb-6">
          Connect your Google Workspace to allow the Arcane Brain to process your tasks, calendar, emails, and documents.
        </p>
        <button 
          onClick={handleLogin}
          disabled={isLoggingIn}
          className="gsi-material-button bg-white text-black px-4 py-2 rounded-lg flex items-center gap-3 hover:bg-slate-50 transition-colors shadow-sm font-medium disabled:opacity-50"
        >
          {isLoggingIn ? <Loader2 className="w-5 h-5 animate-spin" /> : (
            <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="w-5 h-5">
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
              <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
              <path fill="none" d="M0 0h48v48H0z"></path>
            </svg>
          )}
          <span>Sign in with Google</span>
        </button>
      </div>
    );
  }

  return (
    <div className={`p-6 rounded-xl border h-full min-h-[400px] flex flex-col ${theme === 'dark' ? 'bg-black/40 border-white/10' : 'bg-white border-slate-200'}`}>
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-sm font-semibold uppercase tracking-widest flex items-center gap-2 text-blue-400">
          <Search className="w-4 h-4" />
          Executive Integration Node
        </h3>
        <div className="flex items-center gap-3">
          {loadingData && <Loader2 className="w-4 h-4 animate-spin text-blue-400" />}
          <button onClick={handleLogout} className="text-xs text-slate-500 hover:text-rose-400 transition-colors">Disconnect</button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 flex-1 overflow-y-auto pr-2">
        {/* Tasks Node */}
        <div className="bg-black/20 p-4 rounded-lg border border-white/5">
          <h4 className="text-xs uppercase font-bold text-slate-400 mb-3 flex items-center gap-2">
            <CheckSquare className="w-4 h-4 text-emerald-400" /> Active Tasks
          </h4>
          <div className="space-y-2">
            {tasks.length === 0 ? (
              <p className="text-xs text-slate-500 italic">No active tasks detected.</p>
            ) : (
              tasks.map(t => (
                <div key={t.id} className="flex items-start gap-2 text-sm bg-white/5 p-2 rounded">
                  <div className="w-3 h-3 rounded border border-emerald-500/50 mt-1 shrink-0" />
                  <span className="text-slate-300">{t.title}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Calendar Node */}
        <div className="bg-black/20 p-4 rounded-lg border border-white/5">
          <h4 className="text-xs uppercase font-bold text-slate-400 mb-3 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-orange-400" /> Temporal Horizon (Calendar)
          </h4>
          <div className="space-y-2">
            {events.length === 0 ? (
              <p className="text-xs text-slate-500 italic">No upcoming events.</p>
            ) : (
              events.map(e => {
                const date = new Date(e.start.dateTime || e.start.date);
                return (
                  <div key={e.id} className="flex items-start gap-2 text-sm bg-white/5 p-2 rounded">
                    <div className="shrink-0 text-orange-400/80 font-mono text-xs w-12">{date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                    <span className="text-slate-300 truncate">{e.summary}</span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Communications Node */}
        <div className="bg-black/20 p-4 rounded-lg border border-white/5">
          <h4 className="text-xs uppercase font-bold text-slate-400 mb-3 flex items-center gap-2">
            <Mail className="w-4 h-4 text-blue-400" /> Cognitive Influx (Gmail)
          </h4>
          <div className="space-y-2">
            {emails.length === 0 ? (
              <p className="text-xs text-slate-500 italic">Inbox cleared.</p>
            ) : (
              emails.map(m => {
                const subject = m.payload?.headers?.find((h:any) => h.name === 'Subject')?.value || 'No Subject';
                const from = m.payload?.headers?.find((h:any) => h.name === 'From')?.value || 'Unknown';
                return (
                  <div key={m.id} className="flex flex-col text-sm bg-white/5 p-2 rounded">
                    <span className="text-slate-200 truncate">{subject}</span>
                    <span className="text-xs text-slate-500 truncate">{from}</span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Knowledge Node */}
        <div className="bg-black/20 p-4 rounded-lg border border-white/5">
          <h4 className="text-xs uppercase font-bold text-slate-400 mb-3 flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Database className="w-4 h-4 text-emerald-400" /> Hybrid Sync RAG
            </span>
            <button 
              onClick={handleManualSync}
              disabled={isSyncing}
              className="px-2 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 rounded text-[10px] text-emerald-300 flex items-center gap-1 transition-colors disabled:opacity-50"
            >
              {isSyncing ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
              {isSyncing ? 'Syncing...' : 'Force Sync'}
            </button>
          </h4>
          <div className="space-y-3">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-500">Node Status:</span>
              <span className="text-emerald-400 font-mono">{ragStatus?.status || 'Offline'}</span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-500">Synaptic Count:</span>
              <span className="text-slate-200 font-mono">{ragStatus?.totalDocuments || 0} nodes</span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-500">Registry Type:</span>
              <span className="text-slate-400 italic text-[9px]">{ragStatus?.synchronizationType || 'Unknown'}</span>
            </div>
            <div className="pt-2 border-t border-white/5">
              <p className="text-[10px] text-slate-500 leading-tight">
                Topological RAG ensures zero-latency access to long-term memory fragments by caching semantic embeddings in the local agent shim.
              </p>
            </div>
          </div>
        </div>

        {/* Knowledge Node */}
        <div className="bg-black/20 p-4 rounded-lg border border-white/5">
          <h4 className="text-xs uppercase font-bold text-slate-400 mb-3 flex items-center justify-between">
            <span className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-fuchsia-400" /> Semantic Documents
            </span>
            <button 
              onClick={openPicker}
              disabled={!pickerLoaded}
              className="px-2 py-1 bg-white/10 hover:bg-white/20 rounded text-[10px] text-slate-300 flex items-center gap-1 transition-colors disabled:opacity-50"
            >
              <FolderSearch className="w-3 h-3" /> Select
            </button>
          </h4>
          <div className="space-y-2">
            {docs.length === 0 ? (
              <p className="text-xs text-slate-500 italic">No recent documents.</p>
            ) : (
              docs.map(doc => {
                return (
                  <div key={doc.id} className="flex flex-col text-sm bg-white/5 p-2 rounded">
                    <span className="text-slate-200 truncate">{doc.name}</span>
                    <span className="text-xs text-slate-500">
                      {doc.viewedByMeTime ? `Last viewed: ${new Date(doc.viewedByMeTime).toLocaleDateString()}` : 'No date'}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Keep Notes Node */}
        <div className="bg-black/20 p-4 rounded-lg border border-white/5">
          <h4 className="text-xs uppercase font-bold text-slate-400 mb-3 flex items-center gap-2">
            <StickyNote className="w-4 h-4 text-yellow-400" /> Keep Notes
          </h4>
          <div className="space-y-2">
            {notes.length === 0 ? (
              <p className="text-xs text-slate-500 italic">No notes found.</p>
            ) : (
              notes.map((note: any) => (
                <div key={note.name} className="flex flex-col text-sm bg-white/5 p-2 rounded">
                  <span className="text-slate-200 truncate">{note.title || 'Untitled Note'}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Contacts Node */}
        <div className="bg-black/20 p-4 rounded-lg border border-white/5">
          <h4 className="text-xs uppercase font-bold text-slate-400 mb-3 flex items-center gap-2">
            <Users className="w-4 h-4 text-indigo-400" /> Core Contacts
          </h4>
          <div className="space-y-2">
            {contacts.length === 0 ? (
              <p className="text-xs text-slate-500 italic">No contacts synced.</p>
            ) : (
              contacts.map((c: any) => {
                const name = c.names?.[0]?.displayName || 'Unknown';
                const email = c.emailAddresses?.[0]?.value || '';
                return (
                  <div key={c.resourceName} className="flex flex-col text-sm bg-white/5 p-2 rounded">
                    <span className="text-slate-200 truncate">{name}</span>
                    <span className="text-xs text-slate-500 truncate">{email}</span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Chat Spaces Node */}
        <div className="bg-black/20 p-4 rounded-lg border border-white/5">
          <h4 className="text-xs uppercase font-bold text-slate-400 mb-3 flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-emerald-400" /> Communication Spaces
          </h4>
          <div className="space-y-2">
            {spaces.length === 0 ? (
              <p className="text-xs text-slate-500 italic">No spaces active.</p>
            ) : (
              spaces.map((s: any) => (
                <div key={s.name} className="flex items-center gap-2 text-sm bg-white/5 p-2 rounded">
                  <div className="w-2 h-2 rounded-full bg-emerald-500/50" />
                  <span className="text-slate-300 truncate">{s.displayName || s.name}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
