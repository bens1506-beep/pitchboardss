const express = require('express');
const path = require('path');
const Parser = require('rss-parser');

const app = express();
const PORT = process.env.PORT || 3000;

const parser = new Parser({
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
    }
});

const FOOTBALL_DATA_API_KEY = process.env.FOOTBALL_DATA_API_KEY || 'e69838debdd944ce98f16a61295e0305';
const BASE_URL = 'https://api.football-data.org/v4';

app.use(express.static(path.join(__dirname, 'public')));

const apiHeaders = {
    'X-Auth-Token': FOOTBALL_DATA_API_KEY
};

// Proxy Classement
app.get('/api/standings', async (req, res) => {
    try {
        const response = await fetch(`${BASE_URL}/competitions/FL1/standings`, { headers: apiHeaders });
        if (!response.ok) throw new Error(`Erreur API: ${response.status}`);
        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error('Erreur Proxy Standings :', error.message);
        res.status(500).json({ error: 'Erreur lors de la récupération du classement' });
    }
});

// Proxy Matchs (avec données de secours anti-plantage)
app.get('/api/matches', async (req, res) => {
    try {
        const response = await fetch(`${BASE_URL}/competitions/FL1/matches`, { headers: apiHeaders });
        if (!response.ok) throw new Error(`Erreur API: ${response.status}`);
        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error('Erreur Proxy Matches :', error.message);
        res.json({
            matches: [
                {
                    utcDate: new Date().toISOString(),
                    status: 'SCHEDULED',
                    homeTeam: { name: 'Paris Saint-Germain', tla: 'PSG' },
                    awayTeam: { name: 'Olympique de Marseille', tla: 'OM' },
                    score: { fullTime: { home: null, away: null } }
                },
                {
                    utcDate: new Date().toISOString(),
                    status: 'SCHEDULED',
                    homeTeam: { name: 'AS Monaco', tla: 'ASM' },
                    awayTeam: { name: 'Olympique Lyonnais', tla: 'OL' },
                    score: { fullTime: { home: null, away: null } }
                }
            ]
        });
    }
});

// Proxy Liste des Équipes
app.get('/api/teams', async (req, res) => {
    try {
        const response = await fetch(`${BASE_URL}/competitions/FL1/teams`, { headers: apiHeaders });
        if (!response.ok) throw new Error(`Erreur API: ${response.status}`);
        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error('Erreur Proxy Teams :', error.message);
        res.json({
            teams: [
                { id: 524, name: 'Paris Saint-Germain FC', tla: 'PSG' },
                { id: 516, name: 'Olympique de Marseille', tla: 'OM' },
                { id: 523, name: 'Olympique Lyonnais', tla: 'OL' },
                { id: 548, name: 'AS Monaco FC', tla: 'ASM' },
                { id: 512, name: 'Stade Brestois 29', tla: 'SB29' },
                { id: 521, name: 'Lille OSC', tla: 'LOSC' }
            ]
        });
    }
});

// Proxy Détail d'une Équipe / Effectif (Corrigé en /api/teams/:id pour correspondre à team.html)
app.get('/api/teams/:id', async (req, res) => {
    try {
        const teamId = req.params.id;
        const response = await fetch(`${BASE_URL}/teams/${teamId}`, { headers: apiHeaders });
        if (!response.ok) throw new Error(`Erreur API: ${response.status}`);
        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error('Erreur Proxy Team Detail :', error.message);
        res.json({
            name: 'Paris Saint-Germain',
            crest: '',
            venue: 'Parc des Princes',
            coach: { name: 'Entraîneur' },
            squad: [
                { id: 1, name: 'Joueur Exemple 1', position: 'Goalkeeper', nationality: 'France' },
                { id: 2, name: 'Joueur Exemple 2', position: 'Defender', nationality: 'Brazil' },
                { id: 3, name: 'Joueur Exemple 3', position: 'Midfielder', nationality: 'Portugal' },
                { id: 4, name: 'Joueur Exemple 4', position: 'Offence', nationality: 'France' }
            ]
        });
    }
});

// Proxy Buteurs
app.get('/api/scorers', async (req, res) => {
    try {
        const response = await fetch(`${BASE_URL}/competitions/FL1/scorers`, { headers: apiHeaders });
        if (!response.ok) throw new Error(`Erreur API: ${response.status}`);
        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error('Erreur Proxy Scorers :', error.message);
        res.status(500).json({ error: 'Erreur lors de la récupération des buteurs' });
    }
});

// Endpoint Actualités Actu Foot avec tag personnalisé
app.get('/api/news', async (req, res) => {
    try {
        const feed = await parser.parseURL('https://rmcsport.bfmtv.com/rss/football/');
        
        const news = (feed.items || []).slice(0, 5).map(item => {
            const pubDate = item.pubDate ? new Date(item.pubDate) : new Date();
            return {
                time: pubDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
                tag: 'ACTU FOOT',
                title: item.title,
                link: item.link
            };
        });

        res.json(news);
    } catch (error) {
        console.error('Erreur RSS:', error.message);
        res.json([
            { time: '19:00', tag: 'ACTU FOOT', title: 'Le point sur l\'actualité du football en direct.', link: 'https://rmcsport.bfmtv.com/football/' }
        ]);
    }
});
// Route Proxy pour le Tête-à-Tête (Head-to-Head)
app.get('/api/headtohead', async (req, res) => {
    const { team1, team2 } = req.query;
    if (!team1 || !team2) {
        return res.status(400).json({ error: "Paramètres team1 et team2 requis" });
    }

    try {
        // On récupère tous les matchs de Ligue 1
        const response = await fetch(`https://api.football-data.org/v4/competitions/FL1/matches`, {
            headers: { 'X-Auth-Token': FOOTBALL_DATA_API_KEY }
        });
        
        if (!response.ok) throw new Error('Erreur API football-data');
        const data = await response.json();
        const matches = data.matches || [];

        // On filtre les matchs où team1 et team2 s'affrontent (domicile ou extérieur)
        const h2hMatches = matches.filter(m => 
            (m.homeTeam.id == team1 && m.awayTeam.id == team2) || 
            (m.homeTeam.id == team2 && m.awayTeam.id == team1)
        );

        // Calcul des victoires / nuls
        let stats = { team1Wins: 0, draws: 0, team2Wins: 0, total: h2hMatches.length };
        
        h2hMatches.forEach(m => {
            if (m.status === 'FINISHED') {
                const winner = m.score.winner;
                if (winner === 'HOME_TEAM') {
                    if (m.homeTeam.id == team1) stats.team1Wins++;
                    else stats.team2Wins++;
                } else if (winner === 'AWAY_TEAM') {
                    if (m.homeTeam.id == team1) stats.team1Wins++;
                    else stats.team2Wins++;
                } else {
                    stats.draws++;
                }
            }
        });

        res.json({ stats, matches: h2hMatches });
    } catch (error) {
        console.error('Erreur H2H :', error.message);
        
        // Données de secours / Fallback au cas où l'API est indisponible
        res.json({
            stats: { team1Wins: 1, draws: 1, team2Wins: 0, total: 2 },
            matches: [
                {
                    utcDate: new Date().toISOString(),
                    status: 'FINISHED',
                    homeTeam: { id: team1, name: 'Équipe Domicile' },
                    awayTeam: { id: team2, name: 'Équipe Extérieur' },
                    score: { fullTime: { home: 2, away: 1 }, winner: 'HOME_TEAM' }
                }
            ]
        });
    }
});
// Routes pour tes pages HTML spécifiques
app.get('/teams', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'teams.html'));
});

app.get('/team', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'team.html'));
});

app.get('/schedule', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'schedule.html'));
});

app.listen(PORT, () => {
    console.log(`⚡ Serveur PITCHBOARD démarré sur http://localhost:${PORT}`);
});