
/**
 * Generates a Google Calendar link for an Owner Task
 */
export const getGoogleCalendarLink = (title: string, description: string, dueDateTime: string) => {
  const start = new Date(dueDateTime);
  const end = new Date(start.getTime() + 30 * 60 * 1000); // Default 30 mins duration

  const format = (date: Date) => date.toISOString().replace(/-|:|\.\d\d\d/g, "");
  
  const dates = `${format(start)}/${format(end)}`;
  const baseUrl = "https://www.google.com/calendar/render?action=TEMPLATE";
  
  return `${baseUrl}&text=${encodeURIComponent(title)}&details=${encodeURIComponent(description)}&dates=${dates}`;
};
