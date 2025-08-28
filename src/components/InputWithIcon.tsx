import { ChangeEvent, ReactNode } from 'react';
import { Input, InputGroup, InputGroupProps, InputElement, InputProps } from '@chakra-ui/react';

interface InputWithIconProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  children?: ReactNode;
  inputProps?: Omit<InputProps, 'onChange' | 'value' | 'placeholder'>;
  [key: string]: any; // For any additional props
}

const InputWithIcon = ({
  value,
  onChange,
  placeholder = '',
  children,
  inputProps = {},
  ...props
}: InputWithIconProps) => {
  return (
    <InputGroup {...props}>
      {children && (
        <InputElement pointerEvents="none" children={children} />
      )}
      <Input
        value={value}
        onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
        placeholder={placeholder}
        pl={children ? '2.5rem' : undefined}
        {...inputProps}
      />
    </InputGroup>
  );
};

export default InputWithIcon;
