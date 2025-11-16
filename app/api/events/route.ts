import { NextResponse } from 'next/server';
import { nanoid } from 'nanoid';
import fs from 'fs/promises';
import path from 'path';

const DATA_FILE = path.join(process.cwd(), 'data', 'events.json');

async function ensureDataFile() {
  try {
    await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
    try {
      await fs.access(DATA_FILE);
    } catch {
      await fs.writeFile(DATA_FILE, JSON.stringify([]));
    }
  } catch (error) {
    console.error('Error ensuring data file:', error);
  }
}

async function getEvents() {
  await ensureDataFile();
  const data = await fs.readFile(DATA_FILE, 'utf-8');
  return JSON.parse(data);
}

interface Event {
  id: string;
  createdAt: string;
  [key: string]: unknown;
}

async function saveEvents(events: Event[]) {
  await ensureDataFile();
  await fs.writeFile(DATA_FILE, JSON.stringify(events, null, 2));
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const events = await getEvents();
    
    const newEvent: Event = {
      id: nanoid(10),
      ...body,
      createdAt: new Date().toISOString(),
    };

    events.push(newEvent);
    await saveEvents(events);

    return NextResponse.json(newEvent);
  } catch {
    return NextResponse.json({ error: 'Failed to create event' }, { status: 500 });
  }
}
