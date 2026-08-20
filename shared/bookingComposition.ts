export type AppointmentService = {
  id: string | number;
  duration: number;
  price: number | null;
};

export type MatchQuestion = { id: string; text: string };

export function getUnansweredQuestions<T extends MatchQuestion>(questions: T[], answersByQuestionText: Record<string, string>): T[] {
  return questions.filter((question) => !answersByQuestionText[question.text]);
}

export function getAppointmentTotals(services: AppointmentService[]) {
  return {
    durationMinutes: services.reduce((sum, service) => sum + service.duration, 0),
    totalPrice: services.every((service) => service.price != null)
      ? services.reduce((sum, service) => sum + (service.price ?? 0), 0)
      : null,
  };
}
