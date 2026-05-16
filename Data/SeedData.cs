using Api.Models;
using Api.Utils;
using Microsoft.EntityFrameworkCore;

namespace Api.Data;

public static class SeedData
{
    public static async Task SeedAsync(AppDbContext db)
    {
        if (await db.Weeks.AnyAsync()) return;

        var w1 = new Week { Number = 1, Title = "Erste Schritte", Description = "Greetings, courtesies, and your first words." };
        var w2 = new Week { Number = 2, Title = "Zahlen und Zeit", Description = "Numbers, days, and months." };
        var w3 = new Week { Number = 3, Title = "Farben und Familie", Description = "Colors and family vocabulary." };
        var w4 = new Week { Number = 4, Title = "Essen und Trinken", Description = "Food, drinks, the breakfast table." };
        var w5 = new Week { Number = 5, Title = "Verben des Alltags", Description = "Everyday verbs you'll use constantly." };
        var w6 = new Week { Number = 6, Title = "Auf Reisen", Description = "Travel vocabulary and directions." };

        await db.Weeks.AddRangeAsync(w1, w2, w3, w4, w5, w6);
        await db.SaveChangesAsync();

        var sets = new (Week Week, int Order, string Name, string Level, string Desc, (string Front, string Back)[] Words)[]
        {
            (w1, 0, "Hello & Goodbye", "A1", "Basic greetings", new[]
            {
                ("Hallo", "Hello"),
                ("Guten Morgen", "Good morning"),
                ("Guten Tag", "Good day"),
                ("Guten Abend", "Good evening"),
                ("Gute Nacht", "Good night"),
                ("Tschüss", "Bye"),
                ("Auf Wiedersehen", "Goodbye"),
                ("Bis bald", "See you soon"),
                ("Bis morgen", "See you tomorrow"),
                ("Wie geht's?", "How are you?"),
            }),
            (w1, 1, "Polite Phrases", "A1", "Essential courtesy", new[]
            {
                ("Bitte", "Please / you're welcome"),
                ("Danke", "Thank you"),
                ("Danke schön", "Thank you very much"),
                ("Entschuldigung", "Excuse me / sorry"),
                ("Es tut mir leid", "I'm sorry"),
                ("Kein Problem", "No problem"),
                ("Gern geschehen", "You're welcome"),
                ("Bitte schön", "Here you go"),
            }),
            (w2, 0, "Numbers 0-20", "A1", "Counting basics", new[]
            {
                ("null", "zero"), ("eins", "one"), ("zwei", "two"), ("drei", "three"),
                ("vier", "four"), ("fünf", "five"), ("sechs", "six"), ("sieben", "seven"),
                ("acht", "eight"), ("neun", "nine"), ("zehn", "ten"), ("elf", "eleven"),
                ("zwölf", "twelve"), ("dreizehn", "thirteen"), ("vierzehn", "fourteen"),
                ("fünfzehn", "fifteen"), ("sechzehn", "sixteen"), ("siebzehn", "seventeen"),
                ("achtzehn", "eighteen"), ("neunzehn", "nineteen"), ("zwanzig", "twenty"),
            }),
            (w2, 1, "Days of the Week", "A1", "Mon-Sun", new[]
            {
                ("Montag", "Monday"), ("Dienstag", "Tuesday"), ("Mittwoch", "Wednesday"),
                ("Donnerstag", "Thursday"), ("Freitag", "Friday"), ("Samstag", "Saturday"),
                ("Sonntag", "Sunday"), ("heute", "today"), ("morgen", "tomorrow"),
                ("gestern", "yesterday"), ("die Woche", "week"), ("das Wochenende", "weekend"),
            }),
            (w2, 2, "Months", "A1", "January through December", new[]
            {
                ("Januar", "January"), ("Februar", "February"), ("März", "March"),
                ("April", "April"), ("Mai", "May"), ("Juni", "June"),
                ("Juli", "July"), ("August", "August"), ("September", "September"),
                ("Oktober", "October"), ("November", "November"), ("Dezember", "December"),
            }),
            (w3, 0, "Basic Colors", "A1", "Common color words", new[]
            {
                ("rot", "red"), ("blau", "blue"), ("grün", "green"), ("gelb", "yellow"),
                ("schwarz", "black"), ("weiß", "white"), ("grau", "gray"), ("braun", "brown"),
                ("orange", "orange"), ("rosa", "pink"), ("lila", "purple"),
            }),
            (w3, 1, "Immediate Family", "A1", "Mother, father, etc.", new[]
            {
                ("die Mutter", "mother"), ("der Vater", "father"), ("die Eltern", "parents"),
                ("die Tochter", "daughter"), ("der Sohn", "son"), ("die Schwester", "sister"),
                ("der Bruder", "brother"), ("die Geschwister", "siblings"),
                ("die Großmutter", "grandmother"), ("der Großvater", "grandfather"),
                ("das Kind", "child"), ("das Baby", "baby"),
            }),
            (w4, 0, "Drinks", "A1", "Beverages", new[]
            {
                ("das Wasser", "water"), ("der Kaffee", "coffee"), ("der Tee", "tea"),
                ("die Milch", "milk"), ("der Saft", "juice"), ("das Bier", "beer"),
                ("der Wein", "wine"), ("die Limonade", "lemonade"),
                ("die Cola", "cola"), ("der Orangensaft", "orange juice"),
            }),
            (w4, 1, "Breakfast & Bakery", "A1", "Morning foods", new[]
            {
                ("das Brot", "bread"), ("das Brötchen", "bread roll"), ("die Butter", "butter"),
                ("die Marmelade", "jam"), ("der Käse", "cheese"), ("die Wurst", "sausage"),
                ("das Ei", "egg"), ("der Honig", "honey"), ("das Müsli", "muesli"),
                ("die Schokolade", "chocolate"),
            }),
            (w5, 0, "Top 15 Verbs", "A1", "Most used verbs", new[]
            {
                ("sein", "to be"), ("haben", "to have"), ("werden", "to become"),
                ("können", "to be able to"), ("müssen", "must / have to"),
                ("sollen", "should"), ("wollen", "to want"), ("dürfen", "to be allowed"),
                ("mögen", "to like"), ("gehen", "to go"), ("kommen", "to come"),
                ("machen", "to do / make"), ("sagen", "to say"), ("geben", "to give"),
                ("nehmen", "to take"),
            }),
            (w6, 0, "At the Airport", "A2", "Travel vocabulary", new[]
            {
                ("der Flughafen", "airport"), ("das Flugzeug", "airplane"), ("der Flug", "flight"),
                ("das Ticket", "ticket"), ("der Pass", "passport"), ("der Koffer", "suitcase"),
                ("das Gepäck", "luggage"), ("die Ankunft", "arrival"), ("der Abflug", "departure"),
                ("der Gepäckwagen", "luggage cart"),
            }),
            (w6, 1, "Directions", "A1", "Asking the way", new[]
            {
                ("links", "left"), ("rechts", "right"), ("geradeaus", "straight ahead"),
                ("hier", "here"), ("dort", "there"), ("oben", "up / above"),
                ("unten", "down / below"), ("vorne", "in front"), ("hinten", "behind"),
                ("Wo ist...?", "Where is...?"), ("Wie komme ich zu...?", "How do I get to...?"),
            }),
        };

        foreach (var s in sets)
        {
            var set = new WordSet
            {
                Slug = SlugGenerator.Generate(s.Name),
                WeekId = s.Week.Id,
                Name = s.Name,
                Level = s.Level,
                Description = s.Desc,
                DisplayOrder = s.Order,
                IsPublic = true,
                IsOfficial = true,
            };
            await db.WordSets.AddAsync(set);
            await db.SaveChangesAsync();

            int order = 0;
            var words = s.Words.Select(w => new Word
            {
                WordSetId = set.Id, Front = w.Front, Back = w.Back, DisplayOrder = order++,
            });
            await db.Words.AddRangeAsync(words);
        }
        await db.SaveChangesAsync();
    }
}
