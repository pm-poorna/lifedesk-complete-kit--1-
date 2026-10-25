
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Activity, Bell, CalendarDays, Check, CheckCheck, ChevronRight,
  CircleHelp, Clock3, Cloud, FileText, Heart, Link2, ListTodo,
  Mail, MessageCircle, Mic, Plus, Search, Settings, ShieldCheck,
  Sparkles, Trash2, Volume2, WandSparkles, X, AlertTriangle,
  ClipboardList, CalendarCheck, Filter
} from 'lucide-react';
import './styles.css';

const STORE = 'lifedesk.v1';

const starter = {
  tasks: [
    { id: 1, title: 'Make LifeDesk yours', due: '', priority: 'High', done: false, created: Date.now() },
    { id: 2, title: 'Connect Google Calendar when ready', due: '', priority: 'Medium', done: false, created: Date.now() }
  ],
  notes: [{
    id: 1,
    title: 'Welcome to LifeDesk',
    body: 'Your tasks and notes stay in this browser on this device.',
    updated: Date.now()
  }],
  reminders: [],
  settings: { name: 'there', googleClientId: '', notifications: false },
  whatsapp: [],
  gmail: [],
  events: [],
  googleConnected: false
};

function load() {
  try {
    return { ...starter, ...JSON.parse(localStorage.getItem(STORE) || '{}') };
  } catch {
    return starter;
  }
}

function save(data) {
  localStorage.setItem(STORE, JSON.stringify(data));
}

function uid() {
  return Date.now() + Math.floor(Math.random() * 10000);
}

/*
 * Rule-based WhatsApp message analyzer.
 * It identifies likely important messages, but cannot guarantee
 * that every detected message is genuinely important.
 */
function analyzeMessage(message) {
  const text = String(message.text || '').trim();
  const lower = text.toLowerCase();

  const categories = [
    {
      name: 'Deadline',
      pattern: /\b(deadline|due date|submit by|submission date|last date|due tomorrow|due today|before \d|by tonight|by tomorrow|complete by)\b/i
    },
    {
      name: 'Assignment / Project',
      pattern: /\b(assignment|record work|lab record|project report|project submission|submit the report|internal assessment|practical record|homework|coursework)\b/i
    },
    {
      name: 'Exam / Fees',
      pattern: /\b(exam|examination|test starts|hall ticket|semester fee|college fee|fee payment|pay fees|tuition fee|arrear|registration fee)\b/i
    },
    {
      name: 'Appointment / Meeting',
      pattern: /\b(meeting|appointment|interview|scheduled at|schedule changed|rescheduled|conference|placement drive|attend the meeting|meet at \d|meet tomorrow)\b/i
    },
    {
      name: 'Action item',
      pattern: /\b(please complete|please send|please reply|register now|fill out|fill the form|confirm your|bring your|upload your|reply before|don't forget|do not forget|make sure you)\b/i
    },
    {
      name: 'Important announcement',
      pattern: /\b(important announcement|urgent notice|official notice|mandatory|compulsory|all students|circular|postponed|cancelled|canceled|venue changed|timing changed)\b/i
    }
  ];

  const matched = categories.filter(c => c.pattern.test(text));
  if (!matched.length) return null;

  const urgent = /\b(urgent|immediately|asap|right now|final warning|last chance|today only)\b/i.test(lower);
  const dateWords = /\b(today|tomorrow|tonight|this evening|next week|monday|tuesday|wednesday|thursday|friday|saturday|sunday|\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?)\b/i.test(lower);
  const priority = urgent ? 'High' : (dateWords || matched.some(c => /Deadline|Exam|Fees|Appointment/.test(c.name)) ? 'High' : 'Medium');

  let suggestion = 'Review this message and decide whether you need to act.';
  if (/fee|payment|pay fees|tuition/i.test(lower)) {
    suggestion = 'Check the amount and payment deadline before making a payment.';
  } else if (/exam|hall ticket|test/i.test(lower)) {
    suggestion = 'Check the exam date, time, venue, and required documents.';
  } else if (/assignment|project|report|homework|record/i.test(lower)) {
    suggestion = 'Confirm the submission date and add enough time to finish the work.';
  } else if (/interview|placement drive/i.test(lower)) {
    suggestion = 'Check the time, location or meeting link, and required preparation.';
  } else if (/meeting|appointment|scheduled|rescheduled/i.test(lower)) {
    suggestion = 'Verify the date and time and add it to your calendar if needed.';
  } else if (/register|fill out|form|reply|upload|send/i.test(lower)) {
    suggestion = 'Complete the requested action and verify the final submission.';
  }

  return {
    category: matched.map(c => c.name).join(' · '),
    priority,
    urgent,
    suggestion,
    hasDateClue: dateWords,
    text
  };
}

function App() {
  const [data, setData] = useState(load);
  const [tab, setTab] = useState('Overview');
  const [taskText, setTaskText] = useState('');
  const [noteTitle, setNoteTitle] = useState('');
  const [noteBody, setNoteBody] = useState('');
  const [remText, setRemText] = useState('');
  const [remDate, setRemDate] = useState('');
  const [query, setQuery] = useState('');
  const [assistantText, setAssistantText] = useState('');
  const [answer, setAnswer] = useState('');
  const [listening, setListening] = useState(false);
  const [speechOn, setSpeechOn] = useState(true);
  const [toast, setToast] = useState('');
  const [gmailBusy, setGmailBusy] = useState(false);
  const [calendarBusy, setCalendarBusy] = useState(false);
  const [gmailStatus, setGmailStatus] = useState('Not connected');
  const [calendarStatus, setCalendarStatus] = useState('Not connected');
  const [accessToken, setAccessToken] = useState('');
  const [whatsFilter, setWhatsFilter] = useState('All');
  const recognition = useRef(null);
  const fileRef = useRef(null);

  useEffect(() => { save(data); }, [data]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(''), 3500);
    return () => clearTimeout(timer);
  }, [toast]);

  const update = (key, value) => setData(d => ({ ...d, [key]: value }));
  const tasks = data.tasks || [];
  const notes = data.notes || [];
  const reminders = data.reminders || [];
  const whatsapp = data.whatsapp || [];
  const openTasks = tasks.filter(t => !t.done);
  const today = new Date().toISOString().slice(0, 10);

  const analyzedMessages = useMemo(() => {
    return whatsapp.map(m => {
      const analysis = analyzeMessage(m);
      return analysis ? { ...m, analysis } : null;
    }).filter(Boolean);
  }, [whatsapp]);

  const filteredImportantMessages = useMemo(() => {
    return analyzedMessages.filter(m => {
      const searchText = `${m.text} ${m.sender} ${m.analysis.category}`.toLowerCase();
      const matchesQuery = searchText.includes(query.toLowerCase());
      const matchesFilter =
        whatsFilter === 'All' ||
        (whatsFilter === 'High priority' && m.analysis.priority === 'High') ||
        m.analysis.category.includes(whatsFilter);
      return matchesQuery && matchesFilter;
    });
  }, [analyzedMessages, query, whatsFilter]);

  function say(text) {
    if (!speechOn || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.96;
    window.speechSynthesis.speak(utterance);
  }

  function addTask(e) {
    e?.preventDefault();
    if (!taskText.trim()) return;
    update('tasks', [{
      id: uid(), title: taskText.trim(), due: '',
      priority: 'Medium', done: false, created: Date.now()
    }, ...tasks]);
    setTaskText('');
    setToast('Task added');
  }

  function toggleTask(id) {
    update('tasks', tasks.map(t => t.id === id ? { ...t, done: !t.done } : t));
  }

  function removeTask(id) {
    update('tasks', tasks.filter(t => t.id !== id));
  }

  function addNote(e) {
    e.preventDefault();
    if (!noteTitle.trim() && !noteBody.trim()) return;
    update('notes', [{
      id: uid(), title: noteTitle.trim() || 'Untitled note',
      body: noteBody.trim(), updated: Date.now()
    }, ...notes]);
    setNoteTitle('');
    setNoteBody('');
    setToast('Note saved on this device');
  }

  function addReminder(e) {
    e.preventDefault();
    if (!remText.trim() || !remDate) return;
    update('reminders', [{
      id: uid(), title: remText.trim(), when: remDate,
      done: false, notified: false
    }, ...reminders]);
    setRemText('');
    setRemDate('');
    setToast('Reminder saved');
  }

  function createReminderFromMessage(message) {
    const title = `${message.analysis.category.split(' · ')[0]}: ${message.text}`.slice(0, 240);
    const suggestedDate = new Date(Date.now() + 60 * 60 * 1000);
    suggestedDate.setSeconds(0, 0);
    const localDate = new Date(suggestedDate.getTime() - suggestedDate.getTimezoneOffset() * 60000)
      .toISOString().slice(0, 16);

    setRemText(title);
    setRemDate(localDate);
    setTab('Reminders');
    setToast('Reminder details filled in. Check the date and save it.');
  }

  async function enableNotifications() {
    if (!('Notification' in window)) {
      setToast('This browser does not support notifications');
      return;
    }

    try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        setData(d => ({
          ...d,
          settings: { ...d.settings, notifications: true }
        }));
        setToast('Notifications enabled while LifeDesk is open');
      } else {
        setToast('Notification permission was not granted');
      }
    } catch {
      setToast('Could not enable notifications in this browser');
    }
  }

  /*
   * Check reminder times while the app is open.
   * The notification flag prevents the same reminder firing repeatedly.
   */
  useEffect(() => {
    if (
      !data.settings?.notifications ||
      !('Notification' in window) ||
      Notification.permission !== 'granted'
    ) return;

    const now = Date.now();
    const due = (data.reminders || []).filter(r =>
      !r.done && !r.notified && new Date(r.when).getTime() <= now
    );

    if (!due.length) return;

    due.forEach(r => {
      try {
        new Notification('LifeDesk reminder', { body: r.title });
      } catch {
        // Browser notifications may be unavailable in some contexts.
      }
    });

    setData(d => ({
      ...d,
      reminders: (d.reminders || []).map(r =>
        due.some(item => item.id === r.id) ? { ...r, notified: true } : r
      )
    }));
  }, [data.reminders, data.settings]);

  function startVoice() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setToast('Voice input is not supported in this browser. Try Chrome.');
      return;
    }

    const recognitionInstance = new SpeechRecognition();
    recognition.current = recognitionInstance;
    recognitionInstance.lang = 'en-IN';
    recognitionInstance.interimResults = false;
    recognitionInstance.onresult = e => {
      setAssistantText(e.results[0][0].transcript);
      setListening(false);
    };
    recognitionInstance.onerror = () => setListening(false);
    recognitionInstance.onend = () => setListening(false);
    recognitionInstance.start();
    setListening(true);
  }

  function askAssistant(e) {
    e?.preventDefault();
    const q = assistantText.trim();
    if (!q) return;

    const lower = q.toLowerCase();
    let response = 'I can help organize your tasks, notes, reminders and imported WhatsApp messages.';

    if (/today|priorit|what should i do|plan my day/.test(lower)) {
      const dueToday = reminders.filter(r => !r.done && r.when.slice(0, 10) === today);
      response = `You have ${openTasks.length} open tasks and ${dueToday.length} reminders due today. ` +
        (openTasks.slice(0, 3).map((t, i) => `${i + 1}. ${t.title}`).join(' ') ||
          'Your task list is clear. Add one small task to get started.');
    } else if (/task|todo|pending|unfinished/.test(lower)) {
      response = `You have ${openTasks.length} open tasks and ${tasks.filter(t => t.done).length} completed. ` +
        (openTasks.slice(0, 5).map((t, i) => `${i + 1}. ${t.title}`).join(' ') || 'Your task list is clear.');
    } else if (/note|remember/.test(lower)) {
      response = `You have ${notes.length} saved notes. Latest: ${notes[0]?.title || 'No notes yet'}.`;
    } else if (/remind/.test(lower)) {
      response = `You have ${reminders.filter(r => !r.done).length} active reminders.`;
    } else if (/whatsapp|chat|important message|deadline|announcement/.test(lower)) {
      response = `You imported ${whatsapp.length} WhatsApp lines. I detected ${analyzedMessages.length} potentially important messages. ` +
        `${analyzedMessages.filter(m => m.analysis.priority === 'High').length} are marked high priority. Open WhatsApp Import to review them.`;
    } else if (/gmail|email|mail/.test(lower)) {
      response = `Gmail status: ${gmailStatus}.`;
    } else if (/calendar|event|meeting/.test(lower)) {
      response = `Calendar status: ${calendarStatus}.`;
    } else if (/hello|hi\b|hey/.test(lower)) {
      response = 'Hi! I am LifeDesk. What is one thing you want to get done today?';
    }

    setAnswer(response);
    say(response);
    setAssistantText('');
  }

  const filteredTasks = useMemo(
    () => tasks.filter(t => t.title.toLowerCase().includes(query.toLowerCase())),
    [tasks, query]
  );

  function getGoogleToken() {
    return new Promise((resolve, reject) => {
      const clientId = data.settings?.googleClientId?.trim();
      if (!clientId) {
        reject(new Error('Add your Google OAuth Client ID in Settings first.'));
        return;
      }
      if (!window.google?.accounts?.oauth2) {
        reject(new Error('Google sign-in library has not loaded. Check your internet connection and refresh.'));
        return;
      }

      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: 'https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/calendar.readonly',
        callback: response => response.error
          ? reject(new Error(response.error))
          : resolve(response.access_token)
      });
      client.requestAccessToken();
    });
  }

  async function connectGoogle(kind) {
    try {
      if (kind === 'gmail') setGmailBusy(true);
      else setCalendarBusy(true);

      const token = await getGoogleToken();
      setAccessToken(token);
      update('googleConnected', true);

      if (kind === 'gmail') {
        const response = await fetch(
          'https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=12&labelIds=INBOX',
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (!response.ok) throw new Error('Gmail API request failed. Check Gmail API is enabled in Google Cloud.');

        const json = await response.json();
        const messages = await Promise.all((json.messages || []).slice(0, 12).map(async message => {
          const res = await fetch(
            `https://gmail.googleapis.com/gmail/v1/users/me/messages/${message.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          const result = await res.json();
          const headers = result.payload?.headers || [];
          return {
            id: message.id,
            snippet: result.snippet || '',
            subject: headers.find(h => h.name === 'Subject')?.value || '(No subject)',
            from: headers.find(h => h.name === 'From')?.value || 'Unknown sender',
            date: result.internalDate ? new Date(Number(result.internalDate)).toLocaleString() : ''
          };
        }));

        update('gmail', messages);
        setGmailStatus('Connected · read-only');
        setToast(`Loaded ${messages.length} inbox messages`);
      } else {
        const start = new Date().toISOString();
        const end = new Date(Date.now() + 14 * 86400000).toISOString();
        const response = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(start)}&timeMax=${encodeURIComponent(end)}&singleEvents=true&orderBy=startTime&maxResults=20`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (!response.ok) throw new Error('Calendar API request failed. Check Google Calendar API is enabled.');

        const json = await response.json();
        update('events', (json.items || []).map(event => ({
          id: event.id,
          title: event.summary || '(Untitled event)',
          start: event.start?.dateTime || event.start?.date || '',
          end: event.end?.dateTime || event.end?.date || '',
          link: event.htmlLink || ''
        })));
        setCalendarStatus('Connected · read-only');
        setToast(`Loaded ${(json.items || []).length} upcoming events`);
      }
    } catch (error) {
      setToast(error.message || 'Could not connect Google service');
      if (kind === 'gmail') setGmailStatus('Connection needs attention');
      else setCalendarStatus('Connection needs attention');
    } finally {
      setGmailBusy(false);
      setCalendarBusy(false);
    }
  }

  function importWhatsApp(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onload = () => {
      const lines = String(reader.result || '').split(/\r?\n/).filter(Boolean);
      const parsed = lines.map((line, index) => {
        // Supports common WhatsApp text exports:
        // [25/10/2026, 10:30 PM] Sender: message
        // 25/10/2026, 22:30 - Sender: message
        // 10/25/26, 10:30 PM - Sender: message
        const match = line.match(
          /^\[?(\d{1,4}[/-]\d{1,2}[/-]\d{1,4},?\s+\d{1,2}:\d{2}(?:\s?[AP]M)?)\]?\s+-\s+([^:]+):\s?(.*)$/i
        ) || line.match(
          /^(\d{1,4}[/-]\d{1,2}[/-]\d{1,4},?\s+\d{1,2}:\d{2}(?:\s?[AP]M)?)\s+-\s+([^:]+):\s?(.*)$/i
        );

        return {
          id: uid() + index,
          date: match?.[1] || '',
          sender: match?.[2]?.trim() || 'Chat export',
          text: match?.[3]?.trim() || line
        };
      });

      const important = parsed.map(message => ({
        ...message,
        analysis: analyzeMessage(message)
      })).filter(message => message.analysis);

      update('whatsapp', parsed);

      // Notify about important messages only if notifications are enabled
      // and the browser has already granted notification permission.
      if (
        data.settings?.notifications &&
        'Notification' in window &&
        Notification.permission === 'granted' &&
        important.length
      ) {
        const highPriority = important.filter(m => m.analysis.priority === 'High').length;
        try {
          new Notification('LifeDesk found important messages', {
            body: `Found ${important.length} potentially important messages, including ${highPriority} high-priority message(s). Open WhatsApp Import to review them.`
          });
        } catch {
          // Notification support can vary by browser context.
        }
      }

      setToast(`Imported ${parsed.length} lines. Found ${important.length} potentially important messages.`);
    };

    reader.onerror = () => setToast('Could not read this file. Try exporting it again.');
    reader.readAsText(file);
    e.target.value = '';
  }

  function resetLocal() {
    if (confirm('Delete all LifeDesk data stored in this browser? This cannot be undone.')) {
      localStorage.removeItem(STORE);
      setData(starter);
      setToast('Local data cleared');
    }
  }

  const nav = [
    ['Overview', Activity], ['Tasks', ListTodo], ['Notes', FileText],
    ['Reminders', Bell], ['Calendar', CalendarDays], ['Gmail', Mail],
    ['WhatsApp Import', MessageCircle], ['Assistant', Sparkles], ['Settings', Settings]
  ];

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark"><Heart size={21} /></div>
          <div><strong>LifeDesk</strong><small>PERSONAL COMMAND CENTER</small></div>
        </div>
        <div className="workspace-label">WORKSPACE</div>
        <nav>
          {nav.map(([name, Icon]) => (
            <button key={name} className={`nav-item ${tab === name ? 'active' : ''}`} onClick={() => setTab(name)}>
              <Icon size={18} /><span>{name}</span>
              {name === 'Tasks' && openTasks.length > 0 && <b className="nav-count">{openTasks.length}</b>}
              {name === 'WhatsApp Import' && analyzedMessages.length > 0 && <b className="nav-count">{analyzedMessages.length}</b>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="privacy-mini">
            <ShieldCheck size={17} />
            <span><b>Your space, your data</b><small>Local-first by default</small></span>
          </div>
          <div className="profile">
            <div className="avatar">L</div>
            <div><b>LifeDesk user</b><small>Personal workspace</small></div>
            <button title="Settings" onClick={() => setTab('Settings')}><Settings size={16} /></button>
          </div>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div className="breadcrumb">Workspace <ChevronRight size={14} /> <b>{tab}</b></div>
          <div className="top-actions">
            <div className="searchbox"><Search size={16} /><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search tasks or messages…" /></div>
            <button className="icon-btn" title="Enable notifications" onClick={enableNotifications}><Bell size={18} /></button>
            <div className="avatar small">L</div>
          </div>
        </header>

        <div className="content">
          {tab === 'Overview' && <>
            <div className="welcome-row">
              <div><div className="eyebrow">YOUR DAY, YOUR WAY</div><h1>Your day, <span>in focus.</span></h1><p className="subhead">A calmer place to organize what matters.</p></div>
              <button className="primary" onClick={() => setTab('Tasks')}><Plus size={17} /> Add a task</button>
            </div>

            <section className="hero">
              <div className="hero-copy">
                <div className="hero-tag"><Sparkles size={14} /> YOUR PERSONAL SPACE</div>
                <h2>Make room for<br /><em>what matters.</em></h2>
                <p>Keep your tasks, notes, reminders and connected services together. Start small; build your rhythm.</p>
                <button className="hero-button" onClick={() => setTab('Assistant')}>Talk to LifeDesk <ChevronRight size={16} /></button>
              </div>
              <div className="hero-art">
                <div className="orb orb-one" /><div className="orb orb-two" />
                <div className="focus-card">
                  <div className="focus-head"><span>YOUR FOCUS</span><Sparkles size={15} /></div>
                  <div className="focus-number">{openTasks.length.toString().padStart(2, '0')}<small> open tasks</small></div>
                  <div className="progress-track"><div style={{ width: `${tasks.length ? tasks.filter(t => t.done).length / tasks.length * 100 : 0}%` }} /></div>
                  <div className="focus-foot"><CheckCircleMini /> One step at a time</div>
                </div>
                <div className="floating-note"><div className="float-icon"><Clock3 size={15} /></div><span><b>Gentle reminder</b><small>Take a breath. Reset.</small></span></div>
              </div>
            </section>

            <div className="stats-grid">
              <Stat icon={ListTodo} label="Open tasks" value={openTasks.length} hint={`${tasks.filter(t => t.done).length} completed`} color="violet" />
              <Stat icon={FileText} label="Saved notes" value={notes.length} hint="Stored on this device" color="blue" />
              <Stat icon={Bell} label="Active reminders" value={reminders.filter(r => !r.done).length} hint="Your upcoming nudges" color="orange" />
              <Stat icon={MessageCircle} label="Important chats" value={analyzedMessages.length} hint="Detected in WhatsApp import" color="green" />
            </div>

            <div className="overview-grid">
              <section className="panel">
                <div className="panel-head"><div><h3>Today's priorities</h3><p>Small steps still move you forward.</p></div><button className="text-btn" onClick={() => setTab('Tasks')}>View all <ChevronRight size={15} /></button></div>
                <TaskList tasks={openTasks.slice(0, 5)} onToggle={toggleTask} onRemove={removeTask} />
                {!openTasks.length && <Empty text="Nothing waiting on you. Add a task when you're ready." />}
              </section>
              <section className="panel">
                <div className="panel-head"><div><h3>Quick capture</h3><p>Get it out of your head.</p></div><div className="round-icon"><WandSparkles size={17} /></div></div>
                <form className="quick-form" onSubmit={addTask}><input value={taskText} onChange={e => setTaskText(e.target.value)} placeholder="Something you need to do…" /><button className="primary square" aria-label="Add task"><Plus size={18} /></button></form>
                <div className="capture-links">
                  <button onClick={() => setTab('Notes')}><FileText size={16} /> Write a note <ChevronRight size={14} /></button>
                  <button onClick={() => setTab('Reminders')}><Bell size={16} /> Set a reminder <ChevronRight size={14} /></button>
                  <button onClick={() => setTab('WhatsApp Import')}><MessageCircle size={16} /> Review important chats <ChevronRight size={14} /></button>
                  <button onClick={() => setTab('Assistant')}><Mic size={16} /> Talk it through <ChevronRight size={14} /></button>
                </div>
              </section>
            </div>

            <section className="panel integrations-panel">
              <div className="panel-head"><div><h3>Your connected space</h3><p>Optional connections. Nothing links until you choose to connect.</p></div><button className="text-btn" onClick={() => setTab('Settings')}>Configure <ChevronRight size={15} /></button></div>
              <div className="integration-row">
                <Integration icon={Mail} title="Gmail" desc="Read-only inbox overview" status={gmailStatus} />
                <Integration icon={CalendarDays} title="Google Calendar" desc="Upcoming events, read-only" status={calendarStatus} />
                <Integration icon={MessageCircle} title="WhatsApp" desc="Imported text analysis" status={`${whatsapp.length} lines · ${analyzedMessages.length} important`} />
              </div>
            </section>
          </>}

          {tab === 'Tasks' && <>
            <PageTitle eyebrow="GET THINGS DONE" title="Your tasks" desc="Capture it, prioritize it, and take one step." />
            <section className="panel">
              <form className="add-row" onSubmit={addTask}><input value={taskText} onChange={e => setTaskText(e.target.value)} placeholder="Add a task to your list…" /><button className="primary"><Plus size={17} /> Add task</button></form>
              <div className="list-toolbar"><span>{openTasks.length} open · {tasks.length - openTasks.length} completed</span><button className="text-btn" onClick={() => update('tasks', tasks.filter(t => !t.done))}>Clear completed</button></div>
              <TaskList tasks={filteredTasks} onToggle={toggleTask} onRemove={removeTask} showDone />
              <div className="panel-footnote">Tasks are stored locally in this browser. They are not synced across devices.</div>
            </section>
          </>}

          {tab === 'Notes' && <>
            <PageTitle eyebrow="THOUGHTS, KEPT SAFE" title="Notes" desc="A home for ideas, lists, and things you want to remember." />
            <div className="notes-layout">
              <form className="panel note-editor" onSubmit={addNote}><h3>Capture a thought</h3><input value={noteTitle} onChange={e => setNoteTitle(e.target.value)} placeholder="Note title" /><textarea value={noteBody} onChange={e => setNoteBody(e.target.value)} placeholder="Start writing…" rows={7} /><button className="primary"><Plus size={16} /> Save note</button></form>
              <div className="notes-list">{notes.map(n => <article className="note-card" key={n.id}><div className="note-card-head"><div className="note-icon"><FileText size={17} /></div><button className="icon-btn danger" onClick={() => update('notes', notes.filter(x => x.id !== n.id))}><Trash2 size={16} /></button></div><h3>{n.title}</h3><p>{n.body || 'No details added.'}</p><small>Updated {new Date(n.updated).toLocaleString()}</small></article>)}{!notes.length && <Empty text="Your next idea can live here." />}</div>
            </div>
          </>}

          {tab === 'Reminders' && <>
            <PageTitle eyebrow="A GENTLE NUDGE" title="Reminders" desc="Choose a time and let LifeDesk help you remember." />
            <section className="panel">
              <form className="reminder-form" onSubmit={addReminder}>
                <input value={remText} onChange={e => setRemText(e.target.value)} placeholder="What should I remind you about?" required />
                <input type="datetime-local" value={remDate} onChange={e => setRemDate(e.target.value)} required />
                <button className="primary"><Plus size={17} /> Add reminder</button>
              </form>
              <div className="notice"><Bell size={17} /><span>Suggested reminders use a default time one hour from now. Always check the date and time against the original message. Browser notifications require permission and this page to remain open.</span></div>
              <div className="reminder-list">
                {reminders.slice().sort((a, b) => a.when.localeCompare(b.when)).map(r => <div className={`reminder-item ${r.done ? 'muted' : ''}`} key={r.id}>
                  <button className={`check-circle ${r.done ? 'checked' : ''}`} onClick={() => update('reminders', reminders.map(x => x.id === r.id ? { ...x, done: !x.done } : x))}>{r.done && <Check size={14} />}</button>
                  <div className="reminder-info"><b>{r.title}</b><small>{new Date(r.when).toLocaleString()}</small></div>
                  <button className="icon-btn danger" onClick={() => update('reminders', reminders.filter(x => x.id !== r.id))}><Trash2 size={16} /></button>
                </div>)}
                {!reminders.length && <Empty text="No reminders yet. You can also create one from an important WhatsApp message." />}
              </div>
            </section>
          </>}

          {tab === 'Calendar' && <>
            <PageTitle eyebrow="MAKE SPACE FOR WHAT MATTERS" title="Calendar" desc="Upcoming events from your connected Google Calendar." />
            <section className="panel">
              <div className="service-head"><div className="service-icon calendar"><CalendarDays size={22} /></div><div><h3>Google Calendar</h3><p>{calendarStatus}. Read-only access.</p></div><button className="primary" disabled={calendarBusy} onClick={() => connectGoogle('calendar')}>{calendarBusy ? 'Connecting…' : 'Connect / refresh'}</button></div>
              {(data.events || []).map(event => <div className="event-item" key={event.id}><div className="event-date"><b>{event.start ? new Date(event.start).getDate() : '—'}</b><small>{event.start ? new Date(event.start).toLocaleString(undefined, { month: 'short' }) : ''}</small></div><div><b>{event.title}</b><small>{event.start ? new Date(event.start).toLocaleString() : ''}</small></div>{event.link && <a href={event.link} target="_blank" rel="noreferrer">Open</a>}</div>)}
              {!(data.events || []).length && <Empty text="Connect Google Calendar to load your next 14 days of events." />}
            </section>
          </>}

          {tab === 'Gmail' && <>
            <PageTitle eyebrow="INBOX, WITHOUT THE NOISE" title="Gmail overview" desc="A read-only view of recent inbox messages. LifeDesk never sends or deletes email." />
            <section className="panel">
              <div className="service-head"><div className="service-icon gmail"><Mail size={22} /></div><div><h3>Gmail</h3><p>{gmailStatus}. Uses Google read-only authorization.</p></div><button className="primary" disabled={gmailBusy} onClick={() => connectGoogle('gmail')}>{gmailBusy ? 'Loading…' : 'Connect / refresh'}</button></div>
              {(data.gmail || []).map(message => <article className="email-item" key={message.id}><div className="mail-dot" /><div className="email-main"><div className="email-title"><b>{message.subject}</b><small>{message.date}</small></div><small className="sender">{message.from}</small><p>{message.snippet}</p></div></article>)}
              {!(data.gmail || []).length && <Empty text="Connect Gmail to see recent inbox messages here." />}
              <div className="notice"><ShieldCheck size={17} /><span>Google sign-in requests read-only access. Your Client ID is saved in this browser's local settings.</span></div>
            </section>
          </>}

          {tab === 'WhatsApp Import' && <>
            <PageTitle eyebrow="BRING A CONVERSATION INTO FOCUS" title="WhatsApp intelligence" desc="Find likely deadlines, tasks, appointments, and announcements in a text export." />

            <section className="panel">
              <div className="import-box">
                <div className="import-icon"><MessageCircle size={25} /></div>
                <h3>Import a WhatsApp text export</h3>
                <p>In WhatsApp, open a chat → menu → More → Export chat → Without media. Select the .txt file. LifeDesk analyzes its text locally in your browser.</p>
                <input ref={fileRef} type="file" accept=".txt,text/plain" onChange={importWhatsApp} />
                <button className="primary" onClick={() => fileRef.current?.click()}>Choose .txt file</button>
              </div>

              <div className="stats-grid">
                <Stat icon={MessageCircle} label="Imported lines" value={whatsapp.length} hint="Text export only" color="blue" />
                <Stat icon={Sparkles} label="Potentially important" value={analyzedMessages.length} hint="Rule-based detection" color="violet" />
                <Stat icon={AlertTriangle} label="High priority" value={analyzedMessages.filter(m => m.analysis.priority === 'High').length} hint="Review these first" color="orange" />
                <Stat icon={Bell} label="Reminders" value={reminders.length} hint="Saved in LifeDesk" color="green" />
              </div>

              <div className="panel-head">
                <div><h3>Detected important messages</h3><p>These are suggestions, not confirmed facts. Verify the original message.</p></div>
                <ClipboardList size={20} />
              </div>

              <div className="chat-search"><Search size={16} /><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search messages, senders, or categories…" /></div>

              <div className="filter-row">
                <Filter size={16} />
                {['All', 'High priority', 'Deadline', 'Assignment / Project', 'Exam / Fees', 'Appointment / Meeting', 'Action item', 'Important announcement'].map(filter => (
                  <button key={filter} className={`filter-chip ${whatsFilter === filter ? 'selected' : ''}`} onClick={() => setWhatsFilter(filter)}>{filter}</button>
                ))}
              </div>

              <div className="important-messages">
                {filteredImportantMessages.map(message => (
                  <article className="important-message" key={message.id}>
                    <div className="important-message-top">
                      <span className={`priority-badge ${message.analysis.priority.toLowerCase()}`}>{message.analysis.priority} priority</span>
                      <span className="category-label">{message.analysis.category}</span>
                    </div>
                    <div className="chat-meta"><b>{message.sender}</b><small>{message.date}</small></div>
                    <p className="important-message-text">{message.text}</p>
                    <div className="message-suggestion"><Sparkles size={15} /><span>{message.analysis.suggestion}</span></div>
                    <div className="message-actions">
                      <button className="secondary" onClick={() => createReminderFromMessage(message)}><Bell size={15} /> Create reminder</button>
                      <button className="secondary" onClick={() => {
                        setTaskText(message.text.slice(0, 180));
                        setTab('Tasks');
                        setToast('Task text filled in. Press Add task to save it.');
                      }}><Plus size={15} /> Turn into task</button>
                    </div>
                  </article>
                ))}
                {!filteredImportantMessages.length && <Empty text={whatsapp.length ? 'No messages match this filter. Try All or change your search.' : 'Import a WhatsApp .txt export to detect potentially important messages.'} />}
              </div>

              <div className="panel-head"><div><h3>All imported messages</h3><p>Search the original text, including messages not flagged by the analyzer.</p></div></div>
              <div className="chat-lines">
                {whatsapp.filter(message => (`${message.text} ${message.sender}`).toLowerCase().includes(query.toLowerCase())).slice(0, 200).map(message => (
                  <div className="chat-line" key={message.id}>
                    <div className="chat-meta"><b>{message.sender}</b><small>{message.date}</small></div>
                    <p>{message.text}</p>
                    {!analyzeMessage(message) && <button className="text-btn" onClick={() => {
                      const manual = { ...message, analysis: { category: 'Manually selected', priority: 'Medium', suggestion: 'Review this message and choose an appropriate reminder.', text: message.text } };
                      createReminderFromMessage(manual);
                    }}><Bell size={14} /> Remind me about this</button>}
                  </div>
                ))}
                {!whatsapp.length && <Empty text="No chat imported yet." />}
              </div>

              <div className="notice"><ShieldCheck size={17} /><span>Privacy: this analyzer processes imported text in your browser. It does not log in to WhatsApp or read live messages. Keyword detection can miss important messages or flag messages that do not require action.</span></div>
            </section>
          </>}

          {tab === 'Assistant' && <>
            <PageTitle eyebrow="YOUR FREE-FIRST HELPER" title="Talk it through" desc="A lightweight, local assistant for planning your day and finding your LifeDesk information." />
            <section className="assistant-shell">
              <div className="assistant-banner"><div className="assistant-spark"><Sparkles size={24} /></div><div><h2>How can I make today easier?</h2><p>This prototype uses local rules and your saved LifeDesk data. It does not send your private information to an AI provider.</p></div><button className={`sound-toggle ${speechOn ? 'on' : ''}`} onClick={() => setSpeechOn(!speechOn)} title="Toggle spoken replies"><Volume2 size={18} /></button></div>
              <div className="assistant-chat">
                <div className="assistant-message"><div className="assistant-avatar"><Sparkles size={16} /></div><div><b>LifeDesk</b><p>Ask me about your tasks, reminders, important WhatsApp messages, or connected Google services.</p></div></div>
                {answer && <div className="assistant-message"><div className="assistant-avatar"><Sparkles size={16} /></div><div><b>LifeDesk</b><p>{answer}</p></div></div>}
              </div>
              <form className="assistant-input" onSubmit={askAssistant}><input value={assistantText} onChange={e => setAssistantText(e.target.value)} placeholder="Ask LifeDesk something…" /><button type="button" className={`icon-btn ${listening ? 'listening' : ''}`} onClick={startVoice} title="Speak"><Mic size={18} /></button><button className="primary" disabled={!assistantText.trim()}>Send <ChevronRight size={16} /></button></form>
              <div className="prompt-chips">{['What should I do today?', 'Summarize my tasks', 'What reminders do I have?', 'Find important WhatsApp messages'].map(s => <button key={s} onClick={() => setAssistantText(s)}>{s}</button>)}</div>
              <div className="notice"><CircleHelp size={17} /><span>The assistant uses rules, not a full AI model. Voice input depends on browser support.</span></div>
            </section>
          </>}

          {tab === 'Settings' && <>
            <PageTitle eyebrow="YOUR PREFERENCES, YOUR CHOICE" title="Settings" desc="Set up optional integrations and manage your local data." />
            <section className="panel settings-panel">
              <div className="settings-section">
                <div className="settings-heading"><div className="setting-icon"><Link2 size={19} /></div><div><h3>Google integrations</h3><p>One OAuth Client ID can authorize Gmail and Calendar read-only scopes.</p></div></div>
                <label>Google OAuth Web Client ID<input value={data.settings?.googleClientId || ''} onChange={e => update('settings', { ...data.settings, googleClientId: e.target.value })} placeholder="xxxx.apps.googleusercontent.com" /></label>
                <p className="helper">Create a Web application OAuth Client ID in Google Cloud Console. Enable Gmail API and Google Calendar API. Add http://localhost:5173 as an authorized JavaScript origin. Never paste a client secret here.</p>
                <div className="settings-actions"><button className="secondary" onClick={() => { setGmailStatus('Not connected'); setCalendarStatus('Not connected'); setAccessToken(''); setToast('Status reset. Reconnect when ready.'); }}>Reset connection status</button><a href="https://console.cloud.google.com/" target="_blank" rel="noreferrer">Open Google Cloud Console <ChevronRight size={14} /></a></div>
              </div>

              <div className="settings-section">
                <div className="settings-heading"><div className="setting-icon"><Bell size={19} /></div><div><h3>Notifications</h3><p>{data.settings?.notifications ? 'Enabled for this browser' : 'Not enabled'}</p></div></div>
                <button className="secondary" onClick={enableNotifications}>Enable browser notifications</button>
                <p className="helper">When enabled, LifeDesk can notify you about detected important WhatsApp messages during import and due reminders while the app is open. Background notifications while the browser is fully closed are not configured.</p>
              </div>

              <div className="settings-section">
                <div className="settings-heading"><div className="setting-icon"><ShieldCheck size={19} /></div><div><h3>Privacy and local data</h3><p>Tasks, notes, reminders and imports are stored in localStorage on this browser.</p></div></div>
                <button className="danger-btn" onClick={resetLocal}><Trash2 size={16} /> Delete local LifeDesk data</button>
                <p className="helper">This removes local app data from this browser. It does not revoke Google permissions.</p>
              </div>

              <div className="settings-section">
                <div className="settings-heading"><div className="setting-icon"><CircleHelp size={19} /></div><div><h3>What's included in this kit?</h3><p>Working starter features with clear limits.</p></div></div>
                <ul className="feature-list">
                  <li><CheckCheck size={16} /> Local tasks, notes and reminders</li>
                  <li><CheckCheck size={16} /> Browser speech input and spoken replies where supported</li>
                  <li><CheckCheck size={16} /> Google Gmail and Calendar read-only OAuth integration</li>
                  <li><CheckCheck size={16} /> WhatsApp exported .txt import and search</li>
                  <li><CheckCheck size={16} /> Rule-based detection of likely important chat messages</li>
                  <li><CheckCheck size={16} /> Suggested reminders and browser notifications</li>
                </ul>
              </div>
            </section>
          </>}
        </div>

        <footer className="footer"><span>LifeDesk <span className="footer-dot">·</span> Made for a calmer day</span><span><ShieldCheck size={14} /> Local-first prototype</span></footer>
      </main>

      {toast && <div className="toast"><Check size={16} />{toast}<button onClick={() => setToast('')}><X size={14} /></button></div>}
    </div>
  );
}

function CheckCircleMini() {
  return <span className="mini-check"><Check size={10} /></span>;
}

function Stat({ icon: Icon, label, value, hint, color }) {
  return <div className="stat-card"><div className={`stat-icon ${color}`}><Icon size={19} /></div><div className="stat-label">{label}</div><div className="stat-value">{value}</div><div className="stat-hint">{hint}</div></div>;
}

function PageTitle({ eyebrow, title, desc }) {
  return <div className="page-title"><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{desc}</p></div>;
}

function Empty({ text }) {
  return <div className="empty"><div className="empty-icon"><Cloud size={20} /></div><p>{text}</p></div>;
}

function TaskList({ tasks, onToggle, onRemove, showDone = false }) {
  return <div className="task-list">{tasks.filter(t => showDone || !t.done).map(task => (
    <div className={`task-row ${task.done ? 'completed' : ''}`} key={task.id}>
      <button className={`check-circle ${task.done ? 'checked' : ''}`} onClick={() => onToggle(task.id)}>{task.done && <Check size={14} />}</button>
      <div className="task-main"><span>{task.title}</span><div className="task-meta"><i className={`priority ${task.priority?.toLowerCase() || 'medium'}`} />{task.priority || 'Medium'} priority</div></div>
      <button className="icon-btn task-delete" title="Delete task" onClick={() => onRemove(task.id)}><Trash2 size={15} /></button>
    </div>
  ))}</div>;
}

function Integration({ icon: Icon, title, desc, status }) {
  return <div className="integration"><div className="integration-icon"><Icon size={19} /></div><div className="integration-text"><b>{title}</b><small>{desc}</small><span className="integration-status"><i />{status}</span></div></div>;
}

createRoot(document.getElementById('root')).render(<App />);
