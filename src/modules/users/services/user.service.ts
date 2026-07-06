import { UserRepository } from '../repositories/user.repository';
import { User } from '../types/user.entity';

export class UserService {
  constructor(private readonly userRepository: UserRepository) {}

  public async getUserProfile(id: string): Promise<User> {
    const user = await this.userRepository.findById(id);
    if (!user) {
      throw new Error('Usuario no encontrado');
    }
    return user;
  }
}
